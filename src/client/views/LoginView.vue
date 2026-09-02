<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { TaoButton, TaoCard, TaoFormField, TaoInput, toast } from '@1337exp/taoui';
import { ApiError } from '../http';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.login(username.value, password.value);
    await router.push({ name: 'library' });
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Не удалось войти';
    toast().error().message(error.value);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="panel">
      <TaoCard :padding="28" :radius="16">
        <form class="form" @submit.prevent="submit">
          <div class="hero">
            <span class="mark" aria-hidden="true"></span>
            <h1>Облако Музыки</h1>
            <p>Там, где музыка. Войдите, чтобы слушать.</p>
          </div>
          <TaoFormField label="Логин" :error="error && !username ? error : ''">
            <TaoInput v-model="username" autocomplete="username" />
          </TaoFormField>
          <TaoFormField label="Пароль">
            <TaoInput v-model="password" type="password" autocomplete="current-password" />
          </TaoFormField>
          <p v-if="error" class="err">{{ error }}</p>
          <div class="actions">
            <TaoButton type="submit" :loading="loading">Войти</TaoButton>
          </div>
        </form>
      </TaoCard>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(900px 420px at 50% -10%, rgba(255, 219, 77, 0.16), transparent 50%),
    var(--tao-color-bg);
}

.panel {
  width: min(420px, 100%);
}

.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 4px;
}

.actions :deep(.tao-button) {
  width: 150px;
}

.hero {
  text-align: center;
  margin-bottom: 8px;
}

.hero h1 {
  margin: 12px 0 6px;
  font-size: 28px;
  letter-spacing: -0.04em;
  color: var(--tao-color-text-strong);
}

.hero p {
  margin: 0;
  color: var(--tao-color-text-muted);
}

.mark {
  display: inline-block;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--tao-color-accent);
  box-shadow: inset 0 0 0 10px var(--tao-color-surface-raised), inset 0 0 0 13px var(--tao-color-accent);
}

.err {
  margin: 0;
  color: var(--tao-color-danger);
  font-size: 13px;
}
</style>
