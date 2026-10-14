import { Anchor, Button, Group, Paper, Text } from "@mantine/core";
import { Link } from "react-router-dom";
import { usePrivacyChoice } from "../logic/privacy/usePrivacy";

export const ConsentBanner = () => {
  const { needsBanner, answerBanner } = usePrivacyChoice();

  if (!needsBanner) {
    return null;
  }

  return (
    <Paper
      shadow="md"
      radius={0}
      withBorder
      p="md"
      pos="fixed"
      left={0}
      right={0}
      bottom={0}
      style={{ zIndex: 200 }}
      data-testid="consent-banner"
    >
      <Group justify="space-between" gap="md" maw={1120} mx="auto">
        <Text size="sm" style={{ flex: "1 1 260px" }}>
          We use essential cookies to make this site work, and tracking to
          understand how it is used — only if you agree.{" "}
          <Anchor component={Link} to="/privacy" inherit>
            Privacy policy
          </Anchor>
        </Text>
        <Group gap="xs" wrap="nowrap">
          <Button variant="subtle" onClick={() => answerBanner(false)}>
            Decline
          </Button>
          <Button onClick={() => answerBanner(true)}>Accept</Button>
        </Group>
      </Group>
    </Paper>
  );
};
