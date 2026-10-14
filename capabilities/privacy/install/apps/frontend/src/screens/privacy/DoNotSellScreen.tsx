import {
  Anchor,
  Container,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { usePrivacyChoice } from "../../logic/privacy/usePrivacy";
import { DO_NOT_SELL_LABEL } from "./content";

export const DoNotSellScreen = () => (
  <Container size="sm" py="xl" w="100%">
    <Stack gap="lg">
      <Title order={1}>{DO_NOT_SELL_LABEL}</Title>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="lg">
          <Text size="sm">
            You can ask us to stop sending anything about you to our analytics
            provider or any other third party. We also honour a Global Privacy
            Control signal from your browser automatically. Our{" "}
            <Anchor component={Link} to="/privacy" inherit>
              privacy policy
            </Anchor>{" "}
            explains what we collect and why.
          </Text>
          <OptOutSwitch />
        </Stack>
      </Paper>
      <Anchor component={Link} to="/privacy/settings" size="sm">
        Back to privacy settings
      </Anchor>
    </Stack>
  </Container>
);

const OptOutSwitch = () => {
  const { tracking, lockedBy, configured, setDoNotSell } = usePrivacyChoice();

  return (
    <Stack gap="xs">
      <Switch
        label="Do not sell or share my personal information"
        labelPosition="left"
        checked={tracking === "disabled"}
        disabled={!configured || lockedBy === "gpc"}
        onChange={(event) => setDoNotSell(event.currentTarget.checked)}
        styles={{
          body: { width: "100%", justifyContent: "space-between" },
          labelWrapper: { flex: 1 },
        }}
      />
      {lockedBy === "gpc" && (
        <Text size="xs" c="dimmed">
          Your browser sends a Global Privacy Control signal, so this is on for
          you automatically.
        </Text>
      )}
    </Stack>
  );
};
