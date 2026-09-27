/** public/ altındaki bir dosyanın, şablonun yayın yoluna (/tailadmin/) göre adresi. */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, "");
