/** UI-only adapter. No network request, email, or persistence occurs here.
 * Replace this function with the real API integration before public launch.
 * See CONTACT-INTEGRATION.md in the project root.
 */
export async function submitInquiry(_payload) {
  await new Promise(resolve => setTimeout(resolve, 450));
  return { ok: true, mode: 'ui-preview' };
}
