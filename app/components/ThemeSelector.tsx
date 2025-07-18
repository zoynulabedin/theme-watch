import { useState, useEffect } from "react";
import {
  Card,
  Text,
  Box,
  Button,
  BlockStack,
  Select,
  Spinner,
  Banner,
} from "@shopify/polaris";
import type { Theme } from "../types/theme";

interface ThemeSelectorProps {
  selectedTheme: Theme | null;
  onSelect: (theme: Theme | null) => void;
  type: "source" | "target";
}

export default function ThemeSelector({
  selectedTheme,
  onSelect,
  type,
}: ThemeSelectorProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const fetchThemes = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/themes?type=${type}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch themes: ${res.statusText}`);
        }
        const themes = await res.json();
        setThemes(themes);

        if (themes.length > 0 && !selected) {
          setSelected("");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load themes");
      } finally {
        setLoading(false);
      }
    };
    fetchThemes();
  }, [type, selected]);

  const handleSelectChange = (value: string) => {
    setSelected(value);
    const theme = themes.find((t) => t.id === value);
    if (theme) {
      onSelect(theme);
    } else {
      onSelect(null);
    }
  };

  return (
    <Card>
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical">
            <p>{error}</p>
          </Banner>
        )}

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
          disabled={loading}
        />

        {loading && (
          <Box paddingBlock="400">
            <Spinner size="small" />
          </Box>
        )}

        {selectedTheme && !loading && (
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
              {" "}
              <Button
                variant="plain"
                onClick={() => {
                  // Extract numeric theme ID from GraphQL GID
                  const themeId = selectedTheme.id.split("/").pop();
                  // Open theme editor in Shopify admin
                  window.open(
                    `https://admin.shopify.com/themes/${themeId}/editor`,
                    "_blank",
                  );
                }}
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
