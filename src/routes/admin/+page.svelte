<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('admin.title')} — {t('site.name')}</title></svelte:head>

<h1 class="text-2xl font-bold">{t('admin.title')}</h1>
<p class="mt-2 text-ink-700">{data.staff.name} · {t(`role.${data.staff.role}`)}</p>
