<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFormAttributes } from 'svelte/elements';
	import { beforeNavigate } from '$app/navigation';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/08 section 8.3 and docs/05 section 1: sections, sticky Save / Cancel, warning on unsaved changes. */
	type Props = Omit<HTMLFormAttributes, 'method'> & {
		cancelHref: string;
		saving?: boolean;
		submitLabel?: string;
		children: Snippet;
	};
	let { cancelHref, saving = false, submitLabel, children, ...rest }: Props = $props();

	let dirty = $state(false);

	beforeNavigate(({ cancel, type }) => {
		if (!dirty || type === 'form') return;
		if (type === 'leave' || !confirm(t('form.unsaved'))) cancel();
	});
</script>

<form
	method="POST"
	{...rest}
	oninput={() => (dirty = true)}
	onsubmit={() => (dirty = false)}
	class="flex flex-col gap-6"
>
	{@render children()}
	<div
		class="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8"
	>
		<a
			href={cancelHref}
			class="inline-flex min-h-11 items-center rounded-md px-4 font-bold text-navy-700 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
		>
			{t('form.cancel')}
		</a>
		<Button type="submit" loading={saving}>{submitLabel ?? t('form.save')}</Button>
	</div>
</form>
