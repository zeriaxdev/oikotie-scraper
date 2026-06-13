import * as cmd from "./commands";
import * as analysis from "./analyze";
import { cyan, dim, c } from "./format";

function parseDealOpts(args: string[]) {
  const type = (args.find((a) => a === "sale" || a === "rent") ?? "rent") as "rent" | "sale";
  const city = args.find((a) => a.startsWith("--city="))?.split("=")[1];
  const district = args.find((a) => a.startsWith("--district="))?.split("=")[1];
  const minScore = args.find((a) => a.startsWith("--min-score="))?.split("=")[1];
  const limit = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
  return {
    type,
    opts: {
      city,
      district,
      minScore: minScore ? Number(minScore) : undefined,
      limit: limit ? Number(limit) : undefined,
      includeFlagged: args.includes("--all"),
    },
  };
}

function parseMarketArgs(args: string[]) {
  const type = (args.find((a) => a === "sale" || a === "rent") ?? "rent") as "rent" | "sale";
  const city = args.find((a) => a !== "sale" && a !== "rent" && !a.startsWith("--"));
  return { type, city };
}

type SearchState = {
  city?: string;
  district?: string;
  type: "rent" | "sale";
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  rooms?: number;
  sort: string;
  limit: number;
  offset: number;
};

let lastSearch: SearchState = {
  type: "rent",
  sort: "price ASC",
  limit: 20,
  offset: 0,
};

function parseFlag(args: string[], name: string): string | undefined {
  const flag = args.find((a) => a.startsWith(`--${name}=`));
  return flag?.split("=")[1];
}

function parseSearchOpts(args: string[]): Partial<SearchState> {
  const opts: Partial<SearchState> = {};
  const city = parseFlag(args, "city");
  const district = parseFlag(args, "district");
  const type = parseFlag(args, "type");
  const minPrice = parseFlag(args, "min-price");
  const maxPrice = parseFlag(args, "max-price");
  const minSize = parseFlag(args, "min-size");
  const maxSize = parseFlag(args, "max-size");
  const rooms = parseFlag(args, "rooms");
  const sort = parseFlag(args, "sort");
  const limit = parseFlag(args, "limit");
  const offset = parseFlag(args, "offset");

  if (city) opts.city = city;
  if (district) opts.district = district;
  if (type === "rent" || type === "sale") opts.type = type;
  if (minPrice) opts.minPrice = Number(minPrice);
  if (maxPrice) opts.maxPrice = Number(maxPrice);
  if (minSize) opts.minSize = Number(minSize);
  if (maxSize) opts.maxSize = Number(maxSize);
  if (rooms) opts.rooms = Number(rooms);
  if (limit) opts.limit = Number(limit);
  if (offset) opts.offset = Number(offset);
  if (sort) {
    const dir = sort.startsWith("-") ? "DESC" : "ASC";
    const col = sort.replace(/^-/, "");
    opts.sort = `${col} ${dir}`;
  }

  return opts;
}

async function dispatch(input: string) {
  const parts = input.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case "stats":
    case "s":
      cmd.stats();
      break;

    case "search":
    case "find":
    case "f": {
      const opts = parseSearchOpts(args);
      lastSearch = { ...lastSearch, offset: 0, ...opts };
      cmd.search(lastSearch);
      break;
    }

    case "next":
    case "n":
      lastSearch.offset += lastSearch.limit;
      cmd.search(lastSearch);
      break;

    case "prev":
    case "p":
      lastSearch.offset = Math.max(0, lastSearch.offset - lastSearch.limit);
      cmd.search(lastSearch);
      break;

    case "listing":
    case "view":
    case "v": {
      const id = Number(args[0]);
      if (!id) {
        console.log(dim("  Usage: listing <id>"));
        break;
      }
      await cmd.listing(id);
      break;
    }

    case "regions":
    case "r": {
      const type = (args[0] === "sale" ? "sale" : "rent") as "rent" | "sale";
      cmd.regions(type);
      break;
    }

    case "deals":
    case "d": {
      const { type, opts } = parseDealOpts(args);
      analysis.deals(type, opts);
      break;
    }

    case "analyze":
    case "a": {
      const id = Number(args[0]);
      if (!id) {
        console.log(dim("  Usage: analyze <id>"));
        break;
      }
      analysis.analyze(id);
      break;
    }

    case "market":
    case "m": {
      const { type, city } = parseMarketArgs(args);
      analysis.market(type, city);
      break;
    }

    case "open":
    case "o": {
      const id = Number(args[0]);
      if (!id) {
        console.log(dim("  Usage: open <id>"));
        break;
      }
      const url = `https://asunnot.oikotie.fi/vuokra-asunnot/${id}`;
      Bun.$`open ${url}`.quiet();
      console.log(dim(`  Opening ${url}`));
      break;
    }

    case "help":
    case "h":
    case "?":
      cmd.help();
      break;

    case "exit":
    case "quit":
    case "q":
      process.exit(0);

    case "":
    case undefined:
      break;

    default:
      console.log(dim(`  Unknown command: ${command}. Type ${cyan("help")} for usage.`));
  }
}

async function runDirect(args: string[]) {
  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case "stats":
      cmd.stats();
      break;
    case "search":
      lastSearch = { ...lastSearch, ...parseSearchOpts(rest) };
      cmd.search(lastSearch);
      break;
    case "listing":
      await cmd.listing(Number(rest[0]));
      break;
    case "regions":
      cmd.regions((rest[0] === "sale" ? "sale" : "rent") as "rent" | "sale");
      break;
    case "deals": {
      const { type, opts } = parseDealOpts(rest);
      analysis.deals(type, opts);
      break;
    }
    case "analyze":
      analysis.analyze(Number(rest[0]));
      break;
    case "market": {
      const { type, city } = parseMarketArgs(rest);
      analysis.market(type, city);
      break;
    }
    case "help":
      cmd.help();
      break;
    default:
      cmd.help();
  }
}

async function repl() {
  console.log(`\n${c.bold}${c.cyan}  oikotie${c.reset} ${dim("— apartment data explorer")}\n`);
  console.log(dim(`  Type ${cyan("help")} for commands, ${cyan("q")} to exit.\n`));

  const prompt = `${c.cyan}❯${c.reset} `;
  process.stdout.write(prompt);

  for await (const line of console) {
    try {
      await dispatch(line);
    } catch (err) {
      console.error(`  ${c.red}Error:${c.reset}`, (err as Error).message);
    }
    process.stdout.write(prompt);
  }
}

const args = process.argv.slice(2);

if (args.length > 0) {
  runDirect(args);
} else {
  repl();
}
