import { Anchor, Group } from "@mantine/core";
import { Link, useLocation } from "react-router-dom";
import { useMe } from "../logic/authentication/useMe";

const LINKS = [
  { label: "Privacy", to: "/privacy", signedIn: false },
  { label: "Privacy settings", to: "/privacy/settings", signedIn: true },
];

export const PrivacyFooter = () => {
  const { pathname } = useLocation();
  const { isLoggedIn } = useMe();
  const links = LINKS.filter(
    (link) => link.to !== pathname && (isLoggedIn || !link.signedIn),
  );

  if (links.length === 0) {
    return null;
  }

  return (
    <Group
      component="footer"
      justify="center"
      gap="lg"
      px="md"
      py="lg"
      mt="auto"
    >
      {links.map((link) => (
        <Anchor
          key={link.to}
          component={Link}
          to={link.to}
          size="sm"
          c="dimmed"
        >
          {link.label}
        </Anchor>
      ))}
    </Group>
  );
};
