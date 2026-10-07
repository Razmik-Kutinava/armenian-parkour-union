import type { LucideIcon } from '@lucide/svelte';
import Award from '@lucide/svelte/icons/award';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
import Coins from '@lucide/svelte/icons/coins';
import CreditCard from '@lucide/svelte/icons/credit-card';
import FileCheck from '@lucide/svelte/icons/file-check';
import FileText from '@lucide/svelte/icons/file-text';
import GalleryHorizontal from '@lucide/svelte/icons/gallery-horizontal';
import HandHeart from '@lucide/svelte/icons/hand-heart';
import IdCard from '@lucide/svelte/icons/id-card';
import Image from '@lucide/svelte/icons/image';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import ListChecks from '@lucide/svelte/icons/list-checks';
import Newspaper from '@lucide/svelte/icons/newspaper';
import Package from '@lucide/svelte/icons/package';
import Scale from '@lucide/svelte/icons/scale';
import ScrollText from '@lucide/svelte/icons/scroll-text';
import Settings from '@lucide/svelte/icons/settings';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import Users from '@lucide/svelte/icons/users';
import Video from '@lucide/svelte/icons/video';
import type { AdminIcon } from '#lib/server/admin/nav.ts';

export const navIcons: Record<AdminIcon, LucideIcon> = {
	dashboard: LayoutDashboard,
	hero: GalleryHorizontal,
	news: Newspaper,
	pages: FileText,
	events: CalendarDays,
	media: Image,
	users: Users,
	exams: ClipboardCheck,
	certificates: Award,
	staff: IdCard,
	consents: FileCheck,
	videos: Video,
	registrations: ListChecks,
	points: Coins,
	pointRules: Scale,
	products: ShoppingBag,
	orders: Package,
	payments: CreditCard,
	donations: HandHeart,
	settings: Settings,
	audit: ScrollText,
	roles: ShieldCheck
};
