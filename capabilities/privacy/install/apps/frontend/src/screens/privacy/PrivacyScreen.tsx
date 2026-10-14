import { Anchor, Container, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useMe } from "../../logic/authentication/useMe";
import { PRIVACY_POLICY_VERSION, PRIVACY_SECTIONS } from "./content";

const LAST_UPDATED = new Date(PRIVACY_POLICY_VERSION).toLocaleDateString(
  "en-GB",
  { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" },
);

export const PrivacyScreen = () => (
  <Container size="sm" py="xl" w="100%">
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1}>Privacy</Title>
        <Text size="sm" c="dimmed">
          How we handle your data. Last updated {LAST_UPDATED}.
        </Text>
      </Stack>
      <Paper withBorder radius="md" p="lg">
        <Stack gap="lg">
          {PRIVACY_SECTIONS.map((section) => (
            <PrivacySection key={section.title} {...section} />
          ))}
        </Stack>
      </Paper>
      <BackLink />
    </Stack>
  </Container>
);

const BackLink = () => {
  const { isLoggedIn } = useMe();

  return (
    <Anchor component={Link} to="/" size="sm">
      {isLoggedIn ? "Back to the app" : "Back to sign in"}
    </Anchor>
  );
};

const PrivacySection = ({ title, body }: { title: string; body: string }) => (
  <Stack gap={6}>
    <Title order={3} size="h4">
      {title}
    </Title>
    <Text size="sm">{body}</Text>
  </Stack>
);
