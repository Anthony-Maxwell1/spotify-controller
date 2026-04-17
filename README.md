> [!Note]
> 3D printed files for stand inclusive of esp32 knob coming soon!

A spotify controller. Pages are mainly oriented around iPhone 8 size, however should work for larger/smaller screens.

Features:
- No spotify premium required. Works through spicetify.
- Setup script, no technical knowledge required.
- Play, pause, skip.
- Play from album
- Discover, play playlists or search for artists/songs/albums/playlists.
- Like/unlike songs
- Up next view
- Themes (mostly broken themes, to be fixed. Main theme is good though)
- Extra esp32 knob!

Prerequisites:
- [Spicetify](https://spicetify.app/)
- Python installed.

Installation:
Run the following command.
`python -c "import os, subprocess, sys, platform; subprocess.check_call([sys.executable,'-m','venv','venv']); py=os.path.join('venv','Scripts' if os.name=='nt' else 'bin','python'); subprocess.check_call([py,'-m','pip','install','-r','requirements.txt']); subprocess.check_call([os.path.join('setup','windows.bat' if os.name=='nt' else 'linux.sh')], shell=True)"`

And run `spicetify apply` to finalise the changes.

<img width="681" height="389" alt="Screenshot_20260417_192540" src="https://github.com/user-attachments/assets/1b6a1d8f-9b41-40c6-bbf1-f435bcd44373" />

<img width="691" height="396" alt="Screenshot_20260417_192624" src="https://github.com/user-attachments/assets/39ded442-fc8b-4633-9547-57f6738c136d" />

<img width="687" height="395" alt="Screenshot_20260417_192646" src="https://github.com/user-attachments/assets/759b755f-c07c-42de-80a9-19c55ba33b91" />

