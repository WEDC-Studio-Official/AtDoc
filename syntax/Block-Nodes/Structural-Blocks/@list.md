利用 (modifier) 傳遞一個型態陣列 [bullet, number]，直接宣告了：「第一層是圓點，第二層是數字」

```atd
@list(bullet,number)[
  第一層項目 A[第二層]
  第一層項目 B[第二層]
]
```

如果第二層有「多個項目」該怎麼寫？

```atd
@list(bullet,number)[
  第一層項目 A[
    第二層的第一項
    第二層的第二項
  ]
  第一層項目 B
]
```

