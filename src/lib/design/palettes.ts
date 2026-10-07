/** Accent candidates for the owner's choice on /dev/design (docs/08-DESIGN.md, section 16). */
export interface AccentPalette {
	id: string;
	name: string;
	source: string;
	accent500: string;
	accent600: string;
	accent700: string;
	accent100: string;
}

export const accentPalettes: AccentPalette[] = [
	{
		id: 'apricot',
		name: 'Apricot',
		source: 'Armenian apricot, current proposal',
		accent500: '#FF8A1F',
		accent600: '#E5740A',
		accent700: '#B45309',
		accent100: '#FFEBD6'
	},
	{
		id: 'pomegranate',
		name: 'Pomegranate',
		source: 'Pomegranate, carpet red',
		accent500: '#F0525A',
		accent600: '#D93A43',
		accent700: '#B4232C',
		accent100: '#FDE2E3'
	},
	{
		id: 'tuff',
		name: 'Tuff',
		source: 'Pink tuff stone of Yerevan',
		accent500: '#E8896B',
		accent600: '#D06E50',
		accent700: '#A2492E',
		accent100: '#F9E4DC'
	}
];
