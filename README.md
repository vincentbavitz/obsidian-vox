# Obsidian Vox - Smart Voice Transcription

VOX automatically transcribes the audio notes in your Obsidian vault - extracting metadata, categories and tag information. The transcribed text is then placed into its final direcory with its accompanying metadata (frontmatter) and tags.

![readme_visual_1800](https://github.com/vincentbavitz/obsidian-vox/assets/58160433/10528b09-ab04-49e3-8b24-06457d7abb57)

The *unprocessed* directory is watched for new files; upon discovering a new file it will trigger the transcription and save the file to your vault.

Currently your transcriptions are processed on a remote server I set up specifically for Vox at no expense to the users of the plugin. You are limited to 15 transcriptions per day, and I will increase this limit to 100 per day per Vault if there is capacity. Files are only held in memory as buffers and are not saved to disk on the server and no information is saved.

My intention is for Vox to be as easy to use as possible - however if you feel more secure running your own backend, this will be possible following versions.
 
#### Free & Fully Hosted Backend

VOX is all about simplicity and time saving - therefore it's hosted on a dedicated backend with auto-scaling and GPU acceleration. This enables extremely fast transcriptions and remains private by holding data in memory alone. For those would prefer to run things themselves, the option will to use your own backend will be available very soon.


## Motivation

Voice memos are a very convenient and efficient medium to formulate and explicate your ideas. However they suffer from the major drawback that they are not plaintext and cannot be indexed, searched, sorted or categorized.

As your collection of raw voice notes grows, your ability to search through them for important information shrinks. An enormous directory of thousands of audio files is no way to organise our notes. VOX solves this problem by pulling out the important information from your voice notes and intelligently categorizing them (see #Categorization below).

## Instructions

<!-- ### Setting Up The Backend

See [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for detailed setup instructions - then simply update the Obsidian plugin setting "*Self Hosted Backend Location*" to your backend's domain or IP and port. You may also run the backend locally and point your backend to `127.0.0.1:1337`.

> @note - Systems with less than 8GB of memory may struggle when transcribing audio files over 50MB. -->

### In Obsidian

1. Enable VOX in Obsidian plugins
2. Update the plugin settings to suit your input/output folders for your voice notes.
3. Move a voice note over to your watch directory (eg `<Vault>/Voice/unprocessed`) as a test file

#### Example Setup - Mobile Only

> - Phone records voice memos using a voice recorder app, saving the files to `<mobile>/path/to/obsidian/your/watch/folder`
> - Mobile Obsidian app transcribes the voice notes

#### Example Setup - Mobile First Desktop Sync

> - Phone records voice memos using voice recorder app saving to a location on the phone
> - Using RSync or Syncthing or another synchronisation tool, phone syncs voice notes to `<desktop>/path/to/obsidian/your/watch/folder`
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

#### Status Panel

A status panel will provide information about which items are currently being transcribed, which are queued and any errors, incl. any further information.

#### Templates

Allowing users to build their own templates using shortcodes such as `{{ tags }}`, `{{ transcript }}`, `{{ category }}`.

#### AI Summaries & Extras

In the near-future, VOX will add the open-source Llama model to its backend to fascilitate...

- even smarter tag extraction
- optionally outputting summaries in the transcribed text to get an overview of the topic matter


#### Built In Audio Recorder

A built in audio recorder would prompt users for the voice note category and importance rating after a voice note is made, then automatically transcribe it and place it in the right place in their Vault.

## Self Hosting

Self Hosting will be available in future versions - I am working out some technical details on the back-end to make self-hosting simple and easy.
<!-- See my repository [obsidian-vox-backend](https://github.com/vincentbavitz/obsidian-vox-backend) for instructions on self-hosting. -->
