import { AppShell, Button, Group, Title } from "@mantine/core";
import { Outlet } from "react-router-dom";
import { useAdminMe } from "../logic/auth/useAdminMe";
import { useAdminLogout } from "../logic/auth/useAdminLogout";

export const AdminShell = () => {
  const { username } = useAdminMe();
  const logout = useAdminLogout();

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>project-name admin</Title>
          <Group gap="sm">
            <Title order={6} c="dimmed">
              {username}
            </Title>
            <Button variant="subtle" onClick={logout}>
              Log out
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};
