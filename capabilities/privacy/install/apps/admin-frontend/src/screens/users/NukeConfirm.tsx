import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export const NukeConfirm = ({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: () => void;
}) => {
  const [opened, { open, close }] = useDisclosure(false);

  const confirm = () => {
    close();
    onConfirm();
  };

  return (
    <>
      <Button size="xs" color="red" disabled={disabled} onClick={open}>
        Nuke
      </Button>
      <Modal opened={opened} onClose={close} title="Nuke this user?">
        <Stack gap="md">
          <Text size="sm">
            Their name, email and password are erased for good; the account
            stays as “Deleted user” so nothing that points at it breaks. This
            cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={close}>
              Cancel
            </Button>
            <Button color="red" onClick={confirm}>
              Nuke user
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
