import { cn } from "@/lib/utils";

type HomeGreetingProps = {
  baseGreeting: string;
  firstName: string | null;
  className?: string;
  nameClassName?: string;
};

export function HomeGreeting({ baseGreeting, firstName, className, nameClassName }: HomeGreetingProps) {
  return (
    <h1
      className={cn(
        "max-w-4xl pb-5 text-balance text-center text-3xl leading-tight font-medium tracking-tight sm:text-4xl lg:text-6xl",
        className,
      )}
    >
      <span className="text-[#191919] pl-2">{baseGreeting}</span>
      {firstName ? (
        <>
          {", "}
          <span
            className={cn(
              "inline-block bg-linear-to-r from-[#22d3ee] to-[#34d399] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]",
              nameClassName,
            )}
          >
            {firstName}
          </span>
        </>
      ) : null}
      <span className="text-[#191919]">.</span>
    </h1>
  );
}
