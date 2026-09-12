import { Box, Group, Switch, Text, ActionIcon } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import { ReactNode, useId } from "react";
import classes from "./SettingsControls.module.css";

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Optional numeric value that appears when switch is on */
  numericValue?: number;
  onIncrease?: () => void;
  onDecrease?: () => void;
  increaseDisabled?: boolean;
  decreaseDisabled?: boolean;
  /** Optional content to show when expanded/checked */
  children?: ReactNode;
};

export function CompactSwitch({
  label,
  description,
  checked,
  onChange,
  disabled,
  numericValue,
  onIncrease,
  onDecrease,
  increaseDisabled,
  decreaseDisabled,
  children,
}: Props) {
  const inputId = useId();
  const showStepper =
    checked && numericValue !== undefined && onIncrease && onDecrease;

  return (
    <Box className={classes.setting}>
      <div
        className={classes.row}
        data-with-stepper={showStepper ? true : undefined}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text
            component="label"
            htmlFor={inputId}
            className={classes.label}
            data-disabled={disabled || undefined}
            size="sm"
            fw={600}
            lh={1.4}
          >
            {label}
          </Text>
          {description && (
            <Text
              id={`${inputId}-description`}
              size="xs"
              c="dimmed"
              lh={1.5}
              mt={4}
            >
              {description}
            </Text>
          )}
        </Box>

        <Group gap="xs" wrap="nowrap" className={classes.controls}>
          {showStepper && (
            <Group gap={2} wrap="nowrap">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                disabled={disabled || decreaseDisabled}
                aria-label={`Decrease ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrease();
                }}
              >
                <IconMinus size={14} />
              </ActionIcon>

              <Text
                size="sm"
                fw={600}
                ta="center"
                miw={24}
                c="imperial.3"
                className={classes.value}
              >
                {numericValue}
              </Text>

              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                disabled={disabled || increaseDisabled}
                aria-label={`Increase ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrease();
                }}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
          )}

          <Switch
            id={inputId}
            aria-describedby={
              description ? `${inputId}-description` : undefined
            }
            size="sm"
            checked={checked}
            onChange={(e) => onChange(e.currentTarget.checked)}
            disabled={disabled}
          />
        </Group>
      </div>

      {checked && children && <Box mt="xs">{children}</Box>}
    </Box>
  );
}
