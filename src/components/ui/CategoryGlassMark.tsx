import type { Category } from "@/types";
import GlassIcons from "@/components/effects/GlassIcons";
import { CategorySymbol } from "./CategorySymbol";
import { useAppAppearance } from "@/features/voice/useAppAppearance";
const Glass = GlassIcons as React.ComponentType<any>;
export default function CategoryGlassMark({
  category,
  compact = false,
}: {
  category: Category;
  compact?: boolean;
}) {
  const { dark, limited } = useAppAppearance();
  const color =
    (
      {
        tiles: "blue",
        ceramics: compact ? "green" : "purple",
        seats: "indigo",
        sinks: "orange",
        shower_box: "teal",
      } as Record<string, string>
    )[category.id] || "blue";
  if (limited) return <CategorySymbol category={category} size={30} />;
  return (
    <span className="category-glass-mark">
      <Glass
        decorative
        renderMode="dom"
        items={[
          {
            id: category.id,
            icon: <CategorySymbol category={category} size={28} />,
            color,
          },
        ]}
        size={compact ? 42 : 46}
        gap={0}
        columns={1}
        roundness={0.6}
        refraction={0.8}
        bevel={0.6}
        frost={0.28}
        shine={0.85}
        tint="#dfdfdf"
        tintOpacity={dark ? 0.32 : 0.38}
        iconColor="#ffffff"
        plate="tilt"
        tilt={16}
        spread={0.5}
        hover="press"
        parallax={compact ? 0 : 0.25}
        labels="none"
        intro={false}
        theme={dark ? "dark" : "light"}
      />
    </span>
  );
}
