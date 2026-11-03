<script setup lang="ts">
import { computed } from 'vue';
import { TaoSegmented, TaoSegmentedOption } from '@1337exp/taoui';
import { lang, setLang, t, type Lang } from '../i18n';

const model = computed({
  get: () => lang.value,
  set: (value: Lang) => setLang(value),
});
</script>

<template>
  <TaoSegmented v-model="model" size="small" :aria-label="t('lang.label')" class="lang-switch">
    <TaoSegmentedOption value="ru">RU</TaoSegmentedOption>
    <TaoSegmentedOption value="en">EN</TaoSegmentedOption>
  </TaoSegmented>
</template>
