import { Stack, Title } from "@mantine/core";
import { CreateUserForm } from "./CreateUserForm";
import { UsersTable } from "./UsersTable";

export const UsersScreen = () => {
  return (
    <Stack gap="lg" maw={720}>
      <Title order={3}>Users</Title>
      <CreateUserForm />
      <UsersTable />
    </Stack>
  );
};
