## Obsidian Vox - Smart Voice Transcription

Automatically transcribes audio notes from your Obsidian vault - extracting metadata, categories and tag information. The transcribed text is then placed into its final direcory with its accompanying metadata (frontmatter) and tags.

The *unprocessed* directory is watched for new files; upon discovering a new file it will trigger the transcription and output the processed markdown and audio to `<obsidian>/Voice` and `<obsidian>/Voice/audio` respectively. Set your own custom output directory in settings.

## Instructions

1. Set your server backend URL
2. Copy your voice notes to your *unprocessed* directory
3. Voice notes will be automatically transcribed

## Naming Conventions of Voice Memos

Audio notes are ranked in importance depending on their filename prefix.

### Importance Rankings

The convention is to prefix your voice memo filename with R{digit} from R1 -> R5 where the digit
is an importance rating between 1 and 5.


### Voice Memo Categories

Voice memo filenames should be prefixed with their category in order to organise them appropriately.
Here is a list of possible categories along with their prefixes:

- LN - Life Note
- IN - Insight
- DR - Dream
- RE - Relationships
- RM - Ramble
- RN - Rant
- PH - Philosophising
- PO - Political

These category maps can be stored in config.json.

A standard filename is of the following format:
`R{importance}{category} {title}.{extension}`

~~~
## Git Integration (Experimental)
If you're using [obsidian-git](https://github.com/denolehov/obsidian-git), you can automatically commit your transcriptions; turn it on in the settings.
~~~

## Self Hosting
See my repository [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for instructions on self-hosting.

