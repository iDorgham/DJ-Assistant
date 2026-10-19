from mutagen.id3 import ID3
import glob, os

files = sorted(glob.glob(r"D:\Music\My Sets\Music\*.mp3"))
print("files:", len(files))
with_art = 0
for f in files[:20]:
    try:
        tags = ID3(f)
    except Exception as e:
        print("ERR", os.path.basename(f), e)
        continue
    pics = tags.getall("APIC")
    if pics:
        with_art += 1
        for p in pics:
            print(
                os.path.basename(f)[:60],
                "| version", tags.version,
                "| mime", p.mime,
                "| type", p.type,
                "| desc", repr(p.desc),
                "| bytes", len(p.data),
            )
    else:
        print(os.path.basename(f)[:60], "| version", tags.version, "| NO APIC")
print("with art in sample:", with_art)
