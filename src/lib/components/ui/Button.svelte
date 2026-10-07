<script lang="ts">
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		/** Background the button sits on: primary turns accent on dark. */
		surface?: 'light' | 'dark';
		loading?: boolean;
		children: Snippet;
	};

	let {
		variant = 'primary',
		size = 'md',
		surface = 'light',
		loading = false,
		disabled = false,
		type = 'button',
		class: className = '',
		children,
		...rest
	}: Props = $props();

	const sizes = {
		sm: 'h-8 px-3 text-sm',
		md: 'min-h-11 px-4 text-base sm:min-h-10',
		lg: 'h-12 px-6 text-lg'
	};
	const light = {
		primary: 'bg-navy-700 text-surface hover:bg-navy-600 active:bg-navy-800',
		secondary: 'border border-navy-700 text-navy-700 hover:bg-navy-100 active:bg-navy-100',
		ghost: 'text-navy-700 hover:bg-navy-100 active:bg-navy-100',
		danger: 'bg-error-strong text-surface hover:bg-error-fg active:bg-error-fg'
	};
	const dark = {
		primary: 'bg-accent-500 text-navy-950 hover:bg-accent-600 active:bg-accent-600',
		secondary: 'border border-navy-300 text-navy-300 hover:bg-navy-800 active:bg-navy-800',
		ghost: 'text-navy-300 hover:bg-navy-800 active:bg-navy-800',
		danger: 'bg-error-strong text-surface hover:bg-error-fg active:bg-error-fg'
	};
	const ring = {
		light: 'focus-visible:outline-navy-600',
		dark: 'focus-visible:outline-accent-500'
	};
	const tone = $derived((surface === 'dark' ? dark : light)[variant]);
</script>

<button
	{type}
	disabled={disabled || loading}
	aria-busy={loading || undefined}
	class="inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors duration-(--dur-fast) ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {sizes[
		size
	]} {tone} {ring[surface]} {className}"
	{...rest}
>
	{#if loading}
		<LoaderCircle class="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
	{/if}
	{@render children()}
</button>
