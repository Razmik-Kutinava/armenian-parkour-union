<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { CertificateStateValue } from '#lib/validation/certificate-enums.ts';

	let { state }: { state: CertificateStateValue } = $props();
	const tones = { active: 'success', expired: 'warning', revoked: 'error' } as const;
</script>

<Badge tone={tones[state]}>{t(`certificates.verify.state.${state}`)}</Badge>
