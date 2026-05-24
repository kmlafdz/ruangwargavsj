const HARSH_WORDS = [
  // Indonesian vulgarities, variations and potential slurs (lowercase)
  'anjing', 'anjg', 'anj', 'ajg', 'anying', 'anyink', 'bangsat', 'bngst', 'bgsd', 'bajingan', 'bjg',
  'goblok', 'gblk', 'goblog', 'tolol', 'tll', 'idiot', 'idi0t', 'id!ot', 'bego', 'bg0', 'kampret',
  'kmprt', 'sialan', 'tai', 't4i', 'babi', 'b4bi', 'setan', 's3tan', 'brengsek', 'brngsk', 'mampus',
  'sinting', 'pecundang', 'bocah kontol', 'kontol', 'kntl', 'kont*l', 'k0nt0l', 'memek', 'mmk', 'm3m3k',
  'meki', 'ngentot', 'ngntt', 'entot', 'ngetot', 'jancok', 'jncok', 'j4nc0k', 'cuk', 'cok', 'asu',
  'a$u', 'monyet', 'mony3t', 'laknat', 'harampadah', 'harampjadah', 'harampjadah', 'harampadat',
  'pelacur', 'lonte', 'l0nte', 'sundal', 'bangke', 'bngke', 'taikucing', 'taibabi', 'otakudang',
  'mukatembok', 'manusiasampah', 'bjir', 'njir', 'anjir', 'asw', 'jingan', 'bangkelu', 'gobloklu',
  'bejad', 'bajirut', 'kampang', 'kunyuk', 'bacot', 'nyet', 'kntol', 'pantek', 'kimak', 'cibai',
  'peler', 'pantat', 'peju', 'coli', 'tetek', 'toket', 'ngewe', 'perek', 'jablay', 'binal',
  'b4ngs4t', 'k*ntl', 'm*m*k', 'ng*nt*t', 'b*ngs*t', 'bocil', 'incel',

  // English vulgarities, variations and potential slurs (lowercase)
  'fuck', 'fck', 'fk', 'f*ck', 'f**k', 'phuck', 'fuq', 'fucking', 'fcking', 'fuccing', 'fukin',
  'shit', 'sht', 'sh1t', 'sh!t', 'bullshit', 'bullsh*t', 'bs', 'bitch', 'btch', 'b1tch', 'biatch',
  'bastard', 'bstard', 'asshole', 'a-hole', 'assh0le', 'dick', 'dck', 'd1ck', 'pussy', 'pssy',
  'pu$$y', 'cunt', 'cnt', 'c*nt', 'motherfucker', 'mf', 'mfer', 'mthrfkr', 'sonofabitch', 'sob',
  'damn', 'dmn', 'hell', 'h3ll', 'slut', 'sl*t', 'whore', 'wh0re', 'retard', 'rtard', 'r-word',
  'loser', 'l00ser', 'moron', 'mrn', 'stupid', 'stup1d', 'jerk', 'jrk', 'douchebag', 'douche',
  'crap', 'cr4p', 'pissoff', 'p!ssoff', 'wanker', 'wnk', 'twat', 'tw@t', 'prick', 'pr1ck',
  'scumbag', 'scum', 'dipshit', 'dipsh*t', 'jackass', 'jacka$$', 'dumbass', 'dumb@ss',
  'pieceofshit', 'pos', 'freak', 'fr34k', 'nutjob', 'stfu', 'gtfo', 'kys', 'lmfao', 'wtf',
  'omfg', 'tf', 'af', 'idgaf', 'dgaf', 'smhdumbass', 'dumbmf', 'ffs', 'istg', 'ahole',
  'fuckingidiot', 'dumbasskid', 'trashplayer', 'uselessnoob', 'braindeadmoron', 'bitchassloser',
  'stupidmf', 'crymorebitch', 'shutthefuckup', 'yousuck', 'trashteam', 'toxicasshole',
  'dumbfuckingkid', 'nolep', 'betamale', 'simp', 'clown', 'npc', 'cringe', 'yapping',
  'fatherless', 'touchgrass', 'fvck', 'f4ck', 'f***', 'sh**', 'b*tch', 'a**hole'
];

const containsHarshWords = (text) => {
  const normalizedWithSpaces = text.toLowerCase();
  const compressed = normalizedWithSpaces.replace(/[^a-z0-9]/g, '');
  
  for (const word of HARSH_WORDS) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    
    if (word.includes('*') || word.includes('@') || word.includes('!') || word.includes('$')) {
      const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(normalizedWithSpaces)) {
        return { found: true, word };
      }
      continue;
    }

    if (word.length <= 4) {
      const regexBound = new RegExp(`\\b${word}\\b`, 'i');
      if (regexBound.test(normalizedWithSpaces)) {
        return { found: true, word };
      }
    } else {
      if (normalizedWithSpaces.includes(word)) {
        return { found: true, word };
      }
      if (cleanWord.length > 3 && compressed.includes(cleanWord)) {
        return { found: true, word };
      }
    }
  }
  return { found: false, word: '' };
};

console.log("Result for 'Halo semuanya!':", containsHarshWords("Halo semuanya!"));
console.log("Result for 'anjing':", containsHarshWords("anjing"));
console.log("Result for 'test':", containsHarshWords("test"));
