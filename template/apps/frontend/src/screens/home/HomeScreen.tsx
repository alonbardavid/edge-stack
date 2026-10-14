import { AppShell, Button, Group, Stack, Text, Title } from "@mantine/core";
import { useMe } from "../../logic/authentication/useMe";
import { useLogout } from "../../logic/authentication/useLogout";

export const HomeScreen = () => {
  const { name, email } = useMe();
  const logout = useLogout();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Welcome</Title>
          <Button variant="subtle" onClick={logout}>
            Log out
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Stack align="center" justify="center" mt="xl" gap="xs">
          <Title order={2}>Welcome, {name}</Title>
          {email && <Text c="dimmed">{email}</Text>}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
};
