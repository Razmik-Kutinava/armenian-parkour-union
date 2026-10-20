<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 16, docs/07 section 12 p. 4: fees and donations apart, by payment date. */
</script>

<details class="mb-4 rounded-md border border-line bg-surface p-4">
	<summary class="cursor-pointer font-bold text-navy-700">{t('payments.export.title')}</summary>
	<form method="GET" action="/admin/payments/export" class="mt-3 flex flex-wrap items-end gap-3">
		<label class="flex flex-col gap-1 text-sm font-bold text-ink-900">
			{t('payments.filter.from')}
			<input type="date" name="from" class="{controlClass} px-3 font-normal" />
		</label>
		<label class="flex flex-col gap-1 text-sm font-bold text-ink-900">
			{t('payments.filter.to')}
			<input type="date" name="to" class="{controlClass} px-3 font-normal" />
		</label>
		<Button type="submit" name="kind" value="membership" variant="secondary"
			>{t('payments.export.membership')}</Button
		>
		<Button type="submit" name="kind" value="donation" variant="secondary"
			>{t('payments.export.donation')}</Button
		>
	</form>
	<p class="mt-2 text-sm text-ink-700">{t('payments.export.hint')}</p>
</details>
