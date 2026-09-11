import { appPath } from "~/utils/appUrl";
import classes from "./Logo.module.css";

export function Logo() {
  return (
    <span className={classes.logo}>
      <img
        src={appPath("/brand/ti4-draft-command.png")}
        width={52}
        height={52}
        alt=""
      />
      <span className={classes.wordmark}>
        <span className={classes.prefix}>
          Twilight Imperium · Fourth Edition
        </span>
        <span className={classes.name}>
          TI4 <span>Draft Command</span>
        </span>
      </span>
    </span>
  );
}
