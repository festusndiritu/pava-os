/**
 * An edit payload where any field may be `null`, meaning "clear it". A field left `undefined` is
 * left alone by the server, so a form that wants an emptied input to actually empty the stored
 * value has to send `null`, not leave the key out.
 */
export type Clearable<T> = { [K in keyof T]?: T[K] | null };
