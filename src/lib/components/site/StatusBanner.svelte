<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { newsDate } from './news-date';

	type Reminder = { kind: 'expired' | 'ends_soon'; date: Date } | null;

	/* docs/06 section 2: a soft reminder for the signed-in member; the resend button is in /cabinet. */
	let { emailVerified, reminder }: { emailVerified: boolean; reminder: Reminder } = $props();
	const href = (path: string) => localizePath(path, currentLocale());
	const link = 'font-bold underline underline-offset-2 hover:no-underline';
</script>

{#if !emailVerified || reminder}
	<div class="border-b border-line bg-info-bg text-info-fg">
		<div class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-2 text-sm">
			{#if !emailVerified}
				<p>
					{t('banner.verifyEmail')}
					<a class={link} href={href('/cabinet')}>{t('banner.verifyLink')}</a>
				</p>
			{/if}
			{#if reminder}
				<p>
					{t(reminder.kind === 'expired' ? 'banner.expired' : 'banner.endsSoon', {
						date: newsDate(reminder.date, currentLocale())
					})}
					<a class={link} href={href('/cabinet/membership')}>{t('banner.renew')}</a>
				</p>
			{/if}
		</div>
	</div>
{/if}
