import { Text, TextProps, Title, TitleProps } from "@mantine/core";

const Slice = ({ children, ...rest }: { children: string } & TitleProps) => (
  <Title order={3} fw={700} size="h4" {...rest}>
    {children}
  </Title>
);

const Player = ({ children, ...rest }: { children: string } & TextProps) => (
  <Text
    size="lg"
    ta="center"
    fw={700}
    lh={1.4}
    c="var(--command-text-strong)"
    {...rest}
  >
    {children}
  </Text>
);

export const Titles = {
  Slice,
  Player,
};
