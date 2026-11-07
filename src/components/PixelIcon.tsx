// Собственные пиксельные иконки 8×8 (без чужих ассетов). Рисуются как SVG.

const PALETTE: Record<string, string> = {
  g: "#5fbf3a", G: "#3f8f24", d: "#8a5a2b", D: "#5e3b1a", s: "#9e9e9e", S: "#6b6b6b",
  c: "#5ee6e6", C: "#2fb3c9", w: "#ffffff", k: "#1a1626", y: "#ffd23f", Y: "#d19a1d",
  r: "#e8453c", R: "#a8261f", p: "#9b6bff", P: "#7c4dff", b: "#3b6fe0", B: "#244aa8",
  o: "#ff9a3c", l: "#c8b6ff", n: "#e9c49a",
};

const ICONS: Record<string, string[]> = {
  grass: ["gGgggGgg", "ggGgGggG", "dgdGdgdd", "dDddddDd", "ddDdDddd", "dddDdddD", "dDdddDdd", "ddddDddd"],
  diamond: ["........", "...cc...", "..cwcc..", ".cwccCc.", ".cccCCc.", "..cCCc..", "...Cc...", "........"],
  chest: ["DDDDDDDD", "DddddddD", "DddddddD", "DDDyyDDD", "DddyydD.", "DddddddD", "DddddddD", "DDDDDDDD"],
  pickaxe: [".ssssss.", "s.SddS.s", "...dd...", "...dd...", "...dd...", "...dd...", "...dd...", "...DD..."],
  heart: ["........", ".rr..rr.", "rwrrrrRr", "rrrrrrRr", "rrrrrRRr", ".rrrRRr.", "..rRRr..", "...rr..."],
  star: ["...yy...", "...yy...", "yyyyyyyy", ".yyyyyY.", "..yyyY..", ".yyYYyy.", ".yY..Yy.", "y......Y"],
  potion: ["...ww...", "...DD...", "..wllw..", ".wppppw.", ".pPpPpp.", ".pPPPpp.", ".pppppp.", "..pppp.."],
  sword: [".......s", "......sw", ".....sw.", "....sw..", ".d.sw...", "..dw....", ".DdD....", "D..D...."],
  tnt: ["rrRrrRrr", "rRrrRrrR", "wwwwwwww", "wkwkkwkw", "wwwwwwww", "rrRrrRrr", "rRrrRrrR", "rrrrrrrr"],
  cube: ["...PP...", ".PPllPP.", "PllllllP", "PPllllPP", "PpPPPPkP", "PppPPkkP", ".PppPkP.", "...PP..."],
  bedrock: ["SsSSksSS", "sSkSSsSk", "SSsSkSsS", "kSSsSSkS", "SsSkSsSS", "SkSSsSkS", "sSSkSSsS", "SsSsSkSS"],
  globe: ["..bbbb..", ".bgbbgb.", "bggbbbgb", "bbgggbbb", "bbbggbbb", "bgbbbgbb", ".bbbggb.", "..bbbb.."],
  user: ["..nnnn..", ".nnnnnn.", ".nknnkn.", ".nnnnnn.", "..nnnn..", ".PPPPPP.", "PPPPPPPP", "PPPPPPPP"],
};

export const ICON_KEYS = ["grass", "diamond", "chest", "pickaxe", "sword", "tnt", "heart", "star", "potion", "cube", "globe"];

export function PixelIcon({ name, size = 32 }: { name: string; size?: number }) {
  if (name.startsWith("http") || name.startsWith("data:")) {
    return <img src={name} width={size} height={size} className="pixel-img" style={{ borderRadius: 4, objectFit: "cover" }} alt="" />;
  }
  const rows = ICONS[name] ?? ICONS.grass;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {rows.flatMap((row, y) =>
        row.split("").map((ch, x) => (PALETTE[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={PALETTE[ch]} /> : null)),
      )}
    </svg>
  );
}
