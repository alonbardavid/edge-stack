import {
  Anchor,
  Container,
  Divider,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "react-router-dom";
import {
  usePrivacyChoice,
  usePrivacyState,
} from "../../logic/privacy/usePrivacy";
import type { TrackingLock } from "../../logic/privacy/consent";
import { DO_NOT_SELL_LABEL } from "./content";

export const PrivacySettingsScreen = () => (
  <Container size="sm" py="xl" w="100%">
    <Stack gap="lg">
      <Title order={1}>Privacy settings</Title>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="md">
          <AnalyticsSwitch />
          <Divider />
          <Stack gap="xs" align="flex-start">
            <Anchor component={Link} to="/privacy" size="sm">
              Privacy policy
            </Anchor>
            <DoNotSellLink />
          </Stack>
        </Stack>
      </Paper>
      <Anchor component={Link} to="/" size="sm">
        Back to the app
      </Anchor>
    </Stack>
  </Container>
);

const LOCK_EXPLANATIONS: Record<NonNullable<TrackingLock>, string> = {
  do_not_sell:
    "Off because Do Not Sell or Share is on for your account. Undo that choice to switch this back on.",
  gpc: "Off because your browser sends a Global Privacy Control signal. Turn that off to switch this back on.",
};

const AnalyticsSwitch = () => {
  const { tracking, lockedBy, configured, setBrowserTracking } =
    usePrivacyChoice();

  return (
    <Stack gap="xs">
      <Switch
        label="Product analytics"
        labelPosition="left"
        checked={tracking === "enabled"}
        disabled={!configured || lockedBy !== null}
        onChange={(event) => setBrowserTracking(event.currentTarget.checked)}
        styles={switchStyles}
      />
      <Text size="sm" c="dimmed" data-testid="analytics-switch-note">
        {lockedBy
          ? LOCK_EXPLANATIONS[lockedBy]
          : "Share how you use the app from this browser, to help us improve it. Turning this off removes what we stored on this device."}
      </Text>
    </Stack>
  );
};

const DoNotSellLink = () => {
  const { isCalifornia } = usePrivacyState();

  if (!isCalifornia) {
    return null;
  }

  return (
    <Anchor component={Link} to="/do-not-sell" size="sm">
      {DO_NOT_SELL_LABEL}
    </Anchor>
  );
};

const switchStyles = {
  body: { width: "100%", justifyContent: "space-between" },
  labelWrapper: { flex: 1 },
};
