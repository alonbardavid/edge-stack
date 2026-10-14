import { Center, Loader, Stack, Table, Text, TextInput } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { orpc } from "../../logic/api/orpc";
import { useListPage } from "../../logic/useListPage";
import { ListPagination } from "../../components/ListPagination";
import { UserRow } from "./UserRow";

export const UsersTable = () => {
  const list = useListPage();
  const {
    data: page,
    isPending,
    isFetching,
  } = useQuery(
    orpc.listUsers.queryOptions({
      input: list.query,
      placeholderData: keepPreviousData,
    }),
  );
  const users = page?.items ?? [];

  return (
    <Stack gap="md">
      <TextInput
        aria-label="Search users"
        placeholder="Search by name or email"
        value={list.search}
        onChange={(event) => list.setSearch(event.currentTarget.value)}
      />
      {isPending ? (
        <Center p="md">
          <Loader />
        </Center>
      ) : users.length === 0 ? (
        <Text c="dimmed" ta="center" p="md">
          {list.query.q ? "No users match this search." : "No users yet."}
        </Text>
      ) : (
        <Stack gap="md" opacity={isFetching ? 0.6 : 1}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <UserRow key={user.id} user={user} />
              ))}
            </Table.Tbody>
          </Table>
          <ListPagination
            total={page?.total ?? null}
            page={list.page}
            pageSize={list.pageSize}
            shown={users.length}
            noun="users"
            onPage={list.setPage}
            onPageSize={list.setPageSize}
          />
        </Stack>
      )}
    </Stack>
  );
};
