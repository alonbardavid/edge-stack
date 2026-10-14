import { Group, Pagination, Select, Text } from "@mantine/core";
import { LIST_MAX_OFFSET, type ListTotal } from "@lib/contract";

const PAGE_SIZES = ["10", "25", "50", "100"];

export const ListPagination = ({
  total,
  page,
  pageSize,
  shown,
  noun,
  onPage,
  onPageSize,
}: {
  total: ListTotal | null;
  page: number;
  pageSize: number;
  shown: number;
  noun: string;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) => {
  const count = total?.count ?? 0;
  const first = shown === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = shown === 0 ? 0 : first + shown - 1;

  return (
    <Group justify="space-between" gap="sm" wrap="wrap">
      <Text size="sm" c="dimmed">
        {first}–{last} of {count.toLocaleString()}
        {total?.capped ? "+" : ""} {noun}
      </Text>
      <Pagination
        total={pageCount(count, pageSize)}
        value={page}
        onChange={onPage}
        size="sm"
      />
      <Select
        aria-label="Rows per page"
        data={PAGE_SIZES.map((size) => ({
          value: size,
          label: `${size} per page`,
        }))}
        value={String(pageSize)}
        onChange={(size) => size && onPageSize(Number(size))}
        allowDeselect={false}
        w={140}
        size="xs"
      />
    </Group>
  );
};

function pageCount(count: number, pageSize: number): number {
  const reachable = Math.min(count, LIST_MAX_OFFSET + pageSize);
  return Math.max(1, Math.ceil(reachable / pageSize));
}
