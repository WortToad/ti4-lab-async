import { Fragment } from "react";
import { SymbolHelp } from "~/components/SymbolHelp";
import { appPath } from "~/utils/appUrl";
import classes from "./GameTerm.module.css";

const symbols = {
  commodities: { path: "/symbols/commodities.png", label: "Commodities" },
  tradeGoods: { path: "/symbols/trade-goods.png", label: "Trade goods" },
  promissoryNote: {
    path: "/symbols/promissory-note.png",
    label: "Promissory note",
  },
};

export function GameTerm({
  term,
  children,
  showHelp = true,
}: {
  term: keyof typeof symbols;
  children: string;
  showHelp?: boolean;
}) {
  const symbol = symbols[term];
  return (
    <span className={classes.term}>
      <SymbolHelp label={symbol.label} disabled={!showHelp}>
        <img
          src={appPath(symbol.path)}
          alt=""
          aria-hidden
          width={18}
          height={18}
          className={classes.icon}
        />
      </SymbolHelp>
      <span>{children}</span>
    </span>
  );
}

const gameTerm =
  /\b(?:\d+[ \t]+)?(commodit(?:y|ies)|trade goods?|promissory notes?)\b/gi;

export function GameTerms({
  children,
  showHelp = true,
}: {
  children: string;
  showHelp?: boolean;
}) {
  let previousEnd = 0;
  return (
    <>
      {[...children.matchAll(gameTerm)].map((match) => {
        const preceding = children.slice(previousEnd, match.index);
        previousEnd = match.index + match[0].length;
        const term = match[1].toLowerCase().startsWith("commodit")
          ? "commodities"
          : match[1].toLowerCase().startsWith("trade")
            ? "tradeGoods"
            : "promissoryNote";
        return (
          <Fragment key={match.index}>
            {preceding}
            <GameTerm term={term} showHelp={showHelp}>
              {match[0]}
            </GameTerm>
          </Fragment>
        );
      })}
      {children.slice(previousEnd)}
    </>
  );
}
