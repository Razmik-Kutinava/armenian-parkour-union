<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';

	const variants = ['primary', 'secondary', 'ghost', 'danger'] as const;
	const sizes = ['sm', 'md', 'lg'] as const;
	const cities = [
		{ value: 'yerevan', label: 'Երևան / Ереван / Yerevan' },
		{ value: 'gyumri', label: 'Գյումրի / Гюмри / Gyumri' },
		{ value: 'vanadzor', label: 'Վանաձոր / Ванадзор / Vanadzor', disabled: true }
	];
	let city = $state('');
	let agreed = $state(false);
</script>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-4 rounded-md bg-surface p-6 shadow-sm">
		<h3 class="text-xl font-bold">Button — on light</h3>
		{#each sizes as size (size)}
			<div class="flex flex-wrap items-center gap-3">
				{#each variants as variant (variant)}
					<Button {variant} {size}>{variant} {size}</Button>
				{/each}
			</div>
		{/each}
		<div class="flex flex-wrap items-center gap-3">
			<Button loading>Գրանցվել միջոցառմանը</Button>
			<Button disabled>Disabled</Button>
			<Button variant="secondary" disabled>Disabled</Button>
		</div>
	</div>

	<div class="flex flex-col gap-4 rounded-md bg-navy-950 p-6">
		<h3 class="text-xl font-bold text-surface">Button — on dark</h3>
		<div class="flex flex-wrap items-center gap-3">
			{#each variants as variant (variant)}
				<Button {variant} surface="dark">{variant}</Button>
			{/each}
			<Button surface="dark" loading>Loading</Button>
		</div>
	</div>

	<div class="grid gap-6 rounded-md bg-surface p-6 shadow-sm md:grid-cols-2">
		<h3 class="text-xl font-bold md:col-span-2">Form controls</h3>
		<Input label="Անուն / Имя / Name" placeholder="Arman" hint="As in your ID document" />
		<Input label="Email" type="email" value="arman@" error="Enter a valid email address" />
		<Input label="Disabled" value="Read only value" disabled />
		<Select label="City" options={cities} placeholder="Choose a city" bind:value={city} />
		<Select label="City (error)" options={cities} error="Required field" />
		<div class="flex flex-col">
			<Checkbox bind:checked={agreed} label="I accept the privacy policy and site rules" />
			<Checkbox label="Required checkbox" error="You must accept to continue" />
			<Checkbox label="Disabled" disabled />
		</div>
	</div>
</div>
