/**
 * This is used to ensure a value has the specified type but also preserves any
 * extra type information that the compiler might be able to know about it.
 *
 * Here's a really simple example:
 *
 * ```ts
 * const bestSoftDrink = ensureType<string>()('cola');
 * type BestSoftDrink = typeof bestSoftDrink;
 * ```
 *
 * Above, the compiler knows that `bestSoftDrink` is exactly `'cola'` rather
 * than just `string`. The compiler would also tell you if `'cola'` wasn't a
 * string, for example if you put `{ name: 'cola' }`, it will generate an error.
 *
 * With this extra type information, you can prevent errors like this one:
 *
 * ```ts
 * const evilCorpSoftDrink: BestSoftDrink = 'sparkling water';
 * //    ^^^^^^^^^^^^^^^^^ Type '"sparkling water"' is not assignable to type
 * //                      '"cola"'. ts(2322)
 * ```
 *
 * A more practical example will probably look more like this:
 *
 * ```ts
 * type Song = { name: string; artist?: string };
 * ```
 *
 * Here we require that a song has a name. We also know songs sometimes have
 * artists, and when they do they will have type `string`.
 *
 * We can use this type to define some sad songs, making sure they adhere to the
 * `Song` type:
 *
 * ```ts
 * const sadSongs: Song[] = tuple(
 *   {
 *     name: 'Why oh why is my function undefined?' as const,
 *     artist: 'Chaotic Abyss' as const,
 *   },
 *   {
 *     name: 'I was happy until NullPointerException' as const,
 *     artist: 'Chaotic Abyss' as const,
 *   },
 *   {
 *     name: 'Sometimes 1 + 1 is 11' as const,
 *     artist: 'Chaotic Abyss' as const,
 *   },
 * );
 * ```
 *
 * Suppose we have this function:
 *
 * ```ts
 * pickRandom<T extends unknown[]>(...values: T): T[keyof T];
 * ```
 *
 * When we pick a sad artist at random, the compiler only knows that it is
 * `string | undefined`. How sad:
 *
 * ```ts
 * const sadArtist = pickRandom(sadSongs).artist;
 * //    ^^^^^^^^^ string | undefined
 * ```
 *
 * Contrast this with `favoriteSongs`, which uses `ensureType`:
 *
 * ```ts
 * const favoriteSongs = ensureType<Song[]>()(
 *   tuple(
 *     {
 *       name: 'Wrath of the type lords' as const,
 *       artist: 'Megatron' as const,
 *     },
 *     {
 *       name: 'Correctness bringeth peace' as const,
 *       artist: 'Megatron' as const,
 *     },
 *   ),
 * );
 *
 * const favoriteArtist = pickRandom(favoriteSongs).artist;
 * //    ^^^^^^^^^^^^^^ 'Megatron'
 * ```
 *
 * Suppose we have a function `shout(msg: string): void`. Since all the sad
 * songs do in fact have artists, we should be able to shout `sadArtist` (even
 * though it might make us feel sad).
 *
 * However, the compiler thinks that `sadArtist` might be `undefined`, so it
 * won't let us:
 *
 * ```ts
 * shout(sadArtist);
 * //    ^^^^^^^^^ Argument of type 'string | undefined' is not assignable to
 * //              parameter of type 'string'.
 * //                Type 'undefined' is not assignable to type 'string'.
 * //                ts(2345)
 * ```
 *
 * Contrast this with `favoriteArtist`, which compiles just fine, thanks to the
 * use of `ensureType` with `favoriteSongs`:
 *
 * ```ts
 * shout(favoriteArtist); // ✅
 * ```
 */
const ensureType =
  <T>() =>
  <V extends T>(value: V) =>
    value;

export default ensureType;
