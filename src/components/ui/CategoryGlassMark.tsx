import type {Category} from '@/types';
import GlassIcons from '@/components/effects/GlassIcons';
import {CategorySymbol} from './CategorySymbol';
import {useAppAppearance} from '@/features/voice/useAppAppearance';
const Glass=GlassIcons as React.ComponentType<any>;
export default function CategoryGlassMark({category}:{category:Category}){
 const {dark,limited}=useAppAppearance();
 const color=({tiles:'blue',ceramics:'pink',seats:'purple',sinks:'orange',shower_box:'teal'} as Record<string,string>)[category.id]||'blue';
 if(limited)return <CategorySymbol category={category} size={30}/>;
 return <span className="category-glass-mark"><Glass decorative renderMode="dom" items={[{id:category.id,icon:<CategorySymbol category={category} size={28}/>,color}]} size={44} gap={0} columns={1} roundness={.65} refraction={.35} bevel={.5} frost={.28} shine={.45} tint={dark?'#23374d':'#edf5ff'} tintOpacity={.12} iconColor={dark?'#e1ebf6':'#214c7a'} plate="offset" spread={.12} hover="press" parallax={0} labels="none" intro={false} theme={dark?'dark':'light'}/></span>;
}
