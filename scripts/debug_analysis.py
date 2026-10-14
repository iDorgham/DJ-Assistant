#!/usr/bin/env python3
print('Debugging analysis results...')
print('This would normally run the Rust analysis code via Python bindings')
print('But for now, let'"'"'s just check the expected values from our fixtures')

# Expected values from our analysis fixtures
expected = {
    'analysis/house-128.wav': {
        'bpm': 128.0,
        'key_classical': 'A minor',
        'key_camelot': '8A',
        'analysis_status': 'complete'
    },
    'analysis/techno-140.wav': {
        'bpm': 140.0,
        'key_classical': 'G minor',
        'key_camelot': '9A',
        'analysis_status': 'complete'
    },
    'analysis/dnb-174.wav': {
        'bpm': 174.0,
        'key_classical': 'E minor',
        'key_camelot': '11A',
        'analysis_status': 'complete'
    },
    'analysis/deep-120.wav': {
        'bpm': 120.0,
        'key_classical': 'A minor',
        'key_camelot': '8A',
        'analysis_status': 'complete'
    },
    'analysis/melodic-126.wav': {
        'bpm': 126.0,
        'key_classical': 'C major',
        'key_camelot': '8B',
        'analysis_status': 'complete'
    },
    'analysis/apostrophe-124.wav': {
        'bpm': 124.0,
        'key_classical': 'D minor',
        'key_camelot': '7A',
        'analysis_status': 'complete'
    },
    'analysis/techno-138.wav': {
        'bpm': 138.0,
        'key_classical': 'F# minor',
        'key_camelot': '12A',
        'analysis_status': 'complete'
    }
}

for filepath, exp in expected.items():
    print(f'{filepath}:')
    print(f'  Expected BPM: {exp["bpm"]}')
    print(f'  Expected Key (Classical): {exp["key_classical"]}')
    print(f'  Expected Key (Camelot): {exp["key_camelot"]}')
    print(f'  Expected Analysis Status: {exp["analysis_status"]}')
    print()
