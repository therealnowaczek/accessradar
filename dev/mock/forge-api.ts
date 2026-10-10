export const route = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');

const api = {
  asApp: () => ({
    requestJira: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ globalPermissions: ['USER_PICKER', 'CREATE_SHARED_OBJECTS'] }),
    }),
  }),
};
export default api;
