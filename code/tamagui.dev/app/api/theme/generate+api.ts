import { anthropic } from '@ai-sdk/anthropic'
import { deepseek } from '@ai-sdk/deepseek'
import { openai } from '@ai-sdk/openai'
import { xai } from '@ai-sdk/xai'
import { generateText } from 'ai'
import { apiRoute } from '~/features/api/apiRoute'
import { ensureAccess } from '~/features/api/ensureAccess'
import { ensureAuth } from '~/features/api/ensureAuth'
import { readBodyJSON } from '~/features/api/readBodyJSON'

const models = {
  'grok-beta': xai('grok-beta'),
  'grok-2-1212': xai('grok-2-1212'),
  'deepseek-chat': deepseek(`deepseek-chat`),
  'deepseek-reasoner': deepseek(`deepseek-reasoner`),
  'claude-3-5-sonnet-latest': anthropic('claude-3-5-sonnet-latest'),
  'claude-3-5-haiku-latest': anthropic('claude-3-5-haiku-latest'),
  'gpt-4o-mini': openai('gpt-4o-mini'),
  'gpt-4o': openai('gpt-4o'),
  'gpt-4-turbo': openai('gpt-4-turbo'),
}

export default apiRoute(async (req) => {
  const { supabase } = await ensureAuth({ req })

  try {
    const { hasTakeoutAccess, hasBentoAccess } = await ensureAccess({ req, supabase })

    if (!(hasTakeoutAccess || hasBentoAccess)) {
      throw Response.json(
        {
          error: `First purchase Takeout or Bento!`,
        },
        {
          status: 400,
        }
      )
    }
  } catch (err) {
    throw Response.json(
      {
        error: `First purchase Takeout or Bento!`,
      },
      {
        status: 400,
      }
    )
  }

  const body = await readBodyJSON(req)
  const prompt = body.prompt?.trim()
  const lastReply = body.lastReply?.trim() || ''
  const scheme = body.scheme?.trim() || 'unknown'
  const model = body.model?.trim() || ('reasoner' as 'chat' | 'reasoner')

  if (!prompt) {
    throw Response.json(
      {
        error: `No prompt!`,
      },
      {
        status: 400,
      }
    )
  }

  if (prompt.length > 1000) {
    throw Response.json(
      {
        error: `Prompt too long!`,
      },
      {
        status: 400,
      }
    )
  }

  console.info(`Generating (scheme: ${scheme}, model: ${model}): ${prompt}...`)

  const { text } = await generateText({
    model: models[model] || models['claude-3-5-sonnet-latest'],
    maxTokens: 4_000,
    onStepFinish(event) {
      console.info(event.text)
    },
    prompt: `Help generate Tamagui themes.

The new Tamagui theme system generates basically two themes: base, and accent.
Each theme has a palette it generates from bg (index 0) to fg (index 11).
You set anchors at an index, and then Tamagui will handle spreading the colors between any anchors.

We define them in a custom format to save space.

This is a well formed theme with a grayscale base and blue accent (theme 1):

i: 0
h: 0,0
s: 0.2,0.2
l: 0.99,0.02

i: 9
h: 0,0
s: 0.2,0.2
l: 0.5,0.5

i: 10
h: 0,0
s: 0.2,0.2
l: 0.15,0.925

i: 11
h: 0,0
s: 0.2,0.2
l: 0.03,0.98

###

i: 0
h: 250,250
s: 0.5,0.5
l: 0.4,0.35

i: 9
h: 250,250
s: 0.5,0.5
l: 0.65,0.6

i: 10
h: 250,250
s: 0.5,0.5
l: 0.95,0.9

i: 11
h: 250,250
s: 0.5,0.5
l: 0.95,0.95

Note that "i" = index, "h" = hue, "s" = saturation, "l" = luminosity.
The values are in order of: "light,dark".
Base is the first section, accent is the second, separated by "###".

We generate it for both light and dark mode using comma separation. So for dark mode the lum should be low
(0 to 0.2 or so) for index 0, medium (0.4 to 0.8 or so) for index 9, and then pretty high for 10, and highest at 11.
Likewise for light it should be dark at 0, medium at 9, and then very light at 10 and lightest at 11.

Note that "base" is your low level theme, while "accent" will generate a complimentary theme. So if the user
wants a black and white theme with a pop of red color, you'd generate "base" no saturation, and you'd generate
"accent" with hue at red, and high saturation values.

But if the user wanted a black and white theme where the *text* color is yellow, but the *accent* colors are green, you'd
generate the "base" to have index 0-9 have no saturation, but both 10 and 11 anchors would change the hue to be red.
Then accent would have hue all set to green.

Some notes:

  - Index 0 to 9 are backgrounds, and 11 and 12 are foregrounds (text color).
  - Be sure to keep index 9 readable on index 1, if you need a more flat theme, add an anchor on 8 so 9 can change lum more
  - If there's two main colors, make the base 0-9 the first one, the accent 0-9 the second.
  - Values always go "light,dark". Make sure your dark bg's are darker than the light bg's.
  - We automatically spread the hue/sat/lum between anchors.
  - If b/w, then feel free to just make accent inverse of base and have no hue.
  - Make sure accent 0-9 and accent 10/11 have lots of lum separation
  - If you only have two hues, you can make the accent 0-9 a grey to contrast, or a less saturated or less lum version of base bg.
  - In general don't be afaid to use 3+ hues if the theme allows it.
  - If using 3 bg colors, add a 7 and a 10 anchors with that hue on base
  - If using 4 bg colors, add 7 and 10 anchors on accent with a new hue
  - If adding more hues you can add more anchors at new index
  - You can vary the 10 and 11 index foreground colors hue, but make sure to keep them distinct enough lum from 0
  - If you want a more bold visual look, anchors 0 and 9 can be closer to the middle together lum
  - Light theme backgrounds look good when they are very light (close to 0.99) but you can break this rule for bold themes
  - For strictly black and white themes, ensure there's no saturation on base or accent.
  - In general for text to look good you need your 10 and 11 index to contrast well the 0 and 9 index, for example a light theme generally wants high luminosity for 0 and 9, and low luminosity for 10 and 11.
  - You almost always want the hue of the 0-9 to match, and the hue of the 10-11 to match, but they can be different from each other.
  - Ensure the accent foreground (9-10) lum is far enough from the the accent bg (1) to read.
  - "More bright" to someone in dark mode usually means a anchor 0 that is closer to the middle luminescence, so base would go from l: 1,0 to l: 0.4,0.6
  - "More bright" to someone in light mode usually means the opposite - so l: 0.92,0.1 would go to l: 0.99,0.18

Here's a more punchy example of an "LA Lakers" theme with purple/gold, note the accent theme uses the gold for bg and purple for text,
and adds an anchor at index 3 to make borders a bit more subtle (theme 2):

i: 0
h: 270,270
s: 0.8,0.8
l: 1,0.05

i: 3
h: 270,270
s: 0.8,0.8
l: 0.97,0.1

i: 9
h: 270,270
s: 0.8,0.8
l: 0.4,0.6

i: 10
h: 270,270
s: 0.8,0.8
l: 0.15,0.925

i: 11
h: 270,270
s: 0.8,0.8
l: 0.05,0.96

###

i: 0
h: 55,55
s: 0.9,0.9
l: 0.7,0.4

i: 9
h: 55,55
s: 0.9,0.9
l: 0.4,0.65

i: 10
h: 270,270
s: 0.9,0.9
l: 0.3,0.4

i: 11
h: 270,270
s: 0.9,0.9
l: 0.2,0.5

Bright neon green base. Accent background black and white. Final foreground in the accent (theme 3):

i: 0
h: 100,100
s: 0.9,0.9
l: 0.5,0.34

i: 9
h: 100,100
s: 0.9,0.9
l: 0.3,0.5

i: 10
h: 100,100
s: 0.9,0.9
l: 0.1,0.7

i: 11
h: 100,100
s: 0.9,0.9
l: 0,1

###

i: 0
h: 300,300
s: 0,0
l: 1,0

i: 9
h: 300,300
s: 0,0
l: 0.65,0.6

i: 10
h: 300,300
s: 0.5,0.5
l: 0.4,0.6

i: 11
h: 300,300
s: 0.5,0.5
l: 0.3,0.7

Please write a few sentences to plan out your design first in plain english with minimal formatting before returning the structured data.

Example of good plans:

- Given "Supreme": The SUPREME brand uses bright red backgrounds and white colors like theme 3. In dark mode and light mode base bg is same bright red, up to 9 anchor a still-bright but a bit darker red (in light mode make that go lighter). White fg on both. Accent dark mode is just a darker red scale, with same white fg, light mode accent is a lighter red, with dark red fg.
- Given "Jungle": Can be more subtle like theme 1. Base dark mode do a medium saturation brown bg, subtle lighter green fg. Base light mode *bg* can be a more pastel mid green, then fg a reserved brown. Dark accent can use an extra rich dark brown bg, pink and yellow fg, light accent can be less saturated brown, with bright purple and red fg.

Here's the current color scheme they are using: "${scheme}".
It may be relevant or not, if they say they want a "darker background" when in dark mode, only change dark values.

Be sure to write out your plan first, then put the structured data after. After your plan separate with a "---".

${lastReply && lastReply !== prompt ? `The user had a prompt before this, it may or may not be relevant you can decide: "${lastReply}"` : ''}

The new user prompt is "${prompt}"

Let's try hard to some nice colors:
`,
  })

  try {
    console.info(`Generated: ${text}`)
    const { base, accent, cleaned } = outputToJSON(text)
    return Response.json({
      result: { base, accent },
      reply: cleaned,
    })
  } catch (err) {
    throw Response.json(
      {
        error: `Invalid JSON returned: ${err}`,
      },
      {
        status: 400,
      }
    )
  }
})

function outputToJSON(text: string) {
  const startOfData = text.indexOf('i: ')

  if (startOfData < 0) {
    throw new Error(`Invalid format, no i: `)
  }

  const cleaned = text
    .replace(/.*---/, '')
    .replace(/---.*/, '')
    // remove code blocks around it
    .slice(startOfData)

  const [base, accent] = cleaned.split('###')

  const baseAnchors = parseAnchors(base.trim())
  const accentAnchors = parseAnchors(accent.trim())

  return {
    cleaned,
    base: baseAnchors,
    accent: accentAnchors,
  }
}

function parseAnchors(text: string) {
  const anchors = text.split('\n\n')

  return anchors.map((a) => {
    const [i, h, s, l] = a.split('\n')
    const index = +i.replace('i: ', '')

    return {
      index,
      hue: parseDarkLight('h', h, index),
      sat: parseDarkLight('s', s, index),
      lum: parseDarkLight('l', l, index),
    }
  })
}

function parseDarkLight(name: 'h' | 's' | 'l', line: string, index: number) {
  const [light, dark] = line
    .replace(/[a-z]\:\s+/, '')
    .split(',')
    .map((x) => +x)
  return {
    dark,
    light,
    ...(index === 0 &&
      (name === 'h' || name === 's') && {
        sync: true,
      }),
    ...(index > 0 &&
      index <= 9 &&
      (name === 'h' || name === 's') && {
        syncLeft: true,
        sync: true,
      }),
    ...(index === 10 &&
      (name === 'h' || name === 's') && {
        sync: true,
      }),
    ...(index === 11 &&
      (name === 'h' || name === 's') && {
        syncLeft: true,
        sync: true,
      }),
  }
}
