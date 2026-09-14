import clsx from "clsx";
import Price from "./price";

const Label = ({
  title,
  amount,
  currencyCode,
  position = "bottom",
}: {
  title: string;
  amount: string;
  currencyCode: string;
  position?: "bottom" | "center";
}) => {
  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 flex w-full items-end justify-between gap-3 p-4 @container/label",
        {
          "lg:p-6": position === "center",
        },
      )}
    >
      <h3 className="font-display line-clamp-2 text-sm font-medium leading-tight tracking-tight text-paper">
        {title}
      </h3>
      <Price
        className="data flex-none border border-ink-line bg-ink/80 px-2.5 py-1 text-xs text-reagent backdrop-blur-md"
        amount={amount}
        currencyCode={currencyCode}
        currencyCodeClassName="hidden @[275px]/label:inline text-mute-deep"
      />
    </div>
  );
};

export default Label;
