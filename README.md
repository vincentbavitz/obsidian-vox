# Obsidian Vox - Smart Voice Transcription

VOX automatically transcribes the audio notes in your Obsidian vault - extracting metadata, categories and tag information. The transcribed text is then placed into its final direcory with its accompanying metadata (frontmatter) and tags.

![image]()

The *unprocessed* directory is watched for new files; upon discovering a new file it will trigger the transcription and save the file to your vault.

> Please note that for version 1.0.X you need to run your own backend.

## Motivation

Voice memos are a very convenient and efficient medium to formulate and explicate your ideas. However they suffer from the major drawback that they are not plaintext and cannot be indexed, searched, sorted or categorized.

As your collection of raw of voice notes grows, your ability to search through them for important information shrinks. An enormous directory of thousands of audio files is no way to organise our notes. VOX solves this problem by pulling out the important information from your voice notes and intelligently categorizing them (see #Categorization below).

## Instructions

### Setting Up The Backend

See [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for detailed setup instructions - then simply update the Obsidian plugin setting "*Self Hosted Backend Location*" to your backend's domain or IP and port. You may also run the backend locally and point your backend to `127.0.0.1:1337`.

> @note - Systems with less than 8GB of memory may struggle when transcribing audio files over 50MB.

### In Obsidian

1. Enable VOX in Obsidian plugins
2. Update the plugin settings to suit your input/output folders for your voice notes.
3. Move a voice note over to your watch dircetory (eg `<Vault>/Voice/unprocessed`) as a test file

#### Example Setup - Mobile Only

> - Phone records voice memos using a voice recorder app, saving the files to `<mobile>/path/to/obsidian/your/watch/folder
> - Mobile Obsidian app transcribes the voice notes

#### Example Setup - Mobile First Desktop Sync

> - Phone records voice memos using voice recorder app saving to a location on the phone
> - Using RSync or Syncthing or another synchronisation tool, phone syncs voice notes to `<desktop>/path/to/obsidian/your/watch/folder
> - Desktop Obsidian app transcribes the voice notes

#### Example Setup - Desktop First

> - Desktop/Laptop records voice memo and saves the file directly into Obsidian vault's VOX watch folder
> - Desktop Obsidian app transcribes the voice notes


## Categorization
When saving your voice notes, you may prefix the filename with a special categorization token. This allows VOX to organise your voice notes into distinct categories and importance ratings.

For example, you might find that a voice note of your wedding is an importance of 5/5 while a ramble about your work might be a 1/5 in importance. We could categorize these by setting their filenames like so:

- `R5LN Wedding Night With Charlotte.mp3` -> Importance rating of *5/5* in the category of *Life Note*
- `R1RM Ramble about work issues.mp3` -> Importance rating of *1/5* in the category of *Ramble*

See below for a more detailed explanation.

### Importance Rankings

The convention is to prefix your voice memo filename with R{digit} from R1 -> R5 where the digit
is an importance rating between 1 and 5.

Thusly a standard filename is of the following format: `R{importance}{category} {title}.{extension}`

### Voice Memo Categories

Voice memo filenames should be prefixed with their category in order to organise them appropriately.
Here is a list of example categories along with their prefixes...

- LN - Life Note
- IN - Insight
- DR - Dream
- RE - Relationships
- RM - Ramble
- RN - Rant
- PH - Philosophising
- PO - Political

You may set your own categorization map in the settings - the sky's the limit!

## Roadmap

#### Templates

Allowing users to build their own templates using shortcodes such as `{{ tags }}`, `{{ transcript }}`, `{{ category }}`.

#### GPT Summaries & Extras

In the near-future, VOX will add the open-source and GPT-2 to its backend to fascilitate...

- even smarter tag extraction
- optionally outputting summaries in the transcribed text to get an overview of the topic matter

#### Git Integration

Git integration will be a major pillar of VOX - the integration will ensure that transcribed voice notes are committed to your vault repository without intersecting with your current changes. It would work alongside [obsidian-git](https://github.com/denolehov/obsidian-git).

#### Free & Fully Hosted Backend

VOX is all about simplicity and time saving - therefore in the near future it will be hosted on an auto-scaling dedicated backend with auto-scaling and GPU acceleration. The dedicated backend would add extremely fast transcriptions and would hold data in memory alone. But for those would prefer to run things themselves, the option will remain to use your own backend.

#### Built In Audio Recorder

A built in audio recorder would prompt users for the voice note category and importance rating after a voice note is made, then automatically transcribe it and place it in the right place in their Vault.


~~~
## Git Integration (Experimental)
If you're using [obsidian-git](https://github.com/denolehov/obsidian-git), you can automatically commit your transcriptions; turn it on in the settings.
~~~

## Self Hosting

See my repository [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for instructions on self-hosting.
