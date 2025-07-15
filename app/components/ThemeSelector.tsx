import { useState, useEffect } from "react";
import {
  Card,
  Text,
  Box,
  Button,
  Checkbox,
  BlockStack,
  Select,
} from "@shopify/polaris";

interface Theme {
  id: string;
  name: string;
  date: string;
  description?: string;
}

interface ThemeSelectorProps {
  selectedTheme: Theme | null;
  onSelect: (theme: Theme) => void;
  type: "source" | "target";
}

export default function ThemeSelector({
  selectedTheme,
  onSelect,
  type,
}: ThemeSelectorProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [checked, setChecked] = useState(false);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const fetchThemes = async () => {
      const res = await fetch(`/api/themes?type=${type}`);
      let themes = await res.json();
      themes = themes.map((theme: Theme) => ({
        ...theme,
        description: theme.description || "",
      }));
      setThemes(themes);
      // Only auto-select if none is selected and not the placeholder
      if (
        themes.length > 0 &&
        (!selected ||
          !(themes as Theme[]).some((t: Theme) => t.id === selected))
      ) {
        setSelected(""); // Ensure placeholder is selected by default
      }
    };
    fetchThemes();
  }, [type, selected]);

  const handleSelectChange = (value: string) => {
    setSelected(value);
    const theme = themes.find((t: Theme) => t.id === value);
    if (theme) onSelect(theme);
    // If placeholder is selected, clear selection
    if (value === "") onSelect(null as any);
  };

  return (
    <Card>
      <BlockStack>
        <Select
          label={type === "source" ? "Source Theme" : "Target Theme"}
          options={[
            { label: "Select Theme", value: "" },
            ...themes.map((theme) => ({
              label: theme.name,
              value: theme.id,
            })),
          ]}
          onChange={handleSelectChange}
          value={selected}
        />
        {selectedTheme && (
          <Box paddingBlock="200">
            <Text variant="bodySm" tone="subdued" as="span">
              Created At: {selectedTheme.date}
            </Text>
            {selectedTheme.description && (
              <Text variant="bodySm" as="span">
                {selectedTheme.description}
              </Text>
            )}
            <Box paddingBlock="200">
              <Button
                variant="plain"
                onClick={() => window.open(selectedTheme.id, "_blank")}
              >
                View Theme
              </Button>
            </Box>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}
