<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { RegistrationWindow } from '#lib/server/services/events/window.ts';
	import { eventMoment } from './event-date';

	/* 2.5 default 5: only the registration window until registrations exist (stage 5). */
	let { window }: { window: RegistrationWindow } = $props();
</script>

<span class={window.state === 'open' ? 'text-success-fg' : 'text-ink-500'}>
	{#if window.state === 'open'}{t('events.window.open')}
	{:else if window.state === 'not_open'}{t('events.window.notOpen', {
			date: eventMoment(window.opensAt, currentLocale())
		})}
	{:else}{t('events.window.closed')}{/if}
</span>
