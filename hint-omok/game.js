/*
 * ==========================================
 * 4인 힌트 오목
 * ==========================================
 *
 * GitHub Pages
 * +
 * Firebase Realtime Database
 *
 * 최대 4명
 */


/* ==========================================
   Firebase 준비가 끝나면 실행
   ========================================== */

window.addEventListener(
  "firebaseReady",
  () => {

    startApplication();

  }
);



/* ==========================================
   전역 변수
   ========================================== */

let database = null;

let roomRef = null;

let roomCode = "";

let playerId = "";

let playerNumber = 0;

let currentRoom = null;



/* ==========================================
   Firebase 객체 가져오기
   ========================================== */

function startApplication() {

  database =
    window.firebaseDatabase;


  /*
   * 이 브라우저의 플레이어 ID
   */

  playerId =
    getPlayerId();


  /*
   * 버튼 연결
   */

  document
    .getElementById(
      "createRoomButton"
    )
    .addEventListener(
      "click",
      createRoom
    );


  document
    .getElementById(
      "joinRoomButton"
    )
    .addEventListener(
      "click",
      joinRoom
    );


  document
    .getElementById(
      "startGameButton"
    )
    .addEventListener(
      "click",
      startGame
    );


  /*
   * 방 코드 입력 시 Enter
   */

  document
    .getElementById(
      "roomCodeInput"
    )
    .addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          joinRoom();

        }

      }
    );

}



/* ==========================================
   플레이어 ID
   ========================================== */

function getPlayerId() {

  let id =
    localStorage.getItem(
      "fourPlayerOmokId"
    );


  if (!id) {

    id =
      "p_" +
      Math.random()
        .toString(36)
        .substring(2) +
      Date.now();


    localStorage.setItem(
      "fourPlayerOmokId",
      id
    );

  }


  return id;

}



/* ==========================================
   닉네임
   ========================================== */

function getNickname() {

  const input =
    document.getElementById(
      "nickname"
    );


  const name =
    input.value.trim();


  if (!name) {

    return "플레이어";

  }


  return name.substring(
    0,
    12
  );

}



/* ==========================================
   방 코드 생성
   ========================================== */

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


  let code = "";


  for (
    let i = 0;
    i < 6;
    i++
  ) {

    code +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return code;

}



/* ==========================================
   방 만들기
   ========================================== */

async function createRoom() {

  const message =
    document.getElementById(
      "lobbyMessage"
    );


  let code;


  /*
   * 사용되지 않은 방 코드 생성
   */

  do {

    code =
      generateRoomCode();


    const snapshot =
      await window.firebaseGet(

        window.firebaseRef(
          database,
          "rooms/" + code
        )

      );


    if (!snapshot.exists()) {

      break;

    }

  }
  while (true);



  /*
   * 방 생성
   *
   * 방장은 항상 1번
   */

  const room = {

    hostId:
      playerId,

    phase:
      "waiting",

    players: {

      [playerId]: {

        name:
          getNickname(),

        number:
          1

      }

    },

    board:
      createEmptyBoard(),

    initialStones:
      {},

    target:
      null,

    guesses:
      {},

    hints:
      {},

    result:
      null,

    revealed:
      false

  };


  await window.firebaseSet(

    window.firebaseRef(
      database,
      "rooms/" + code
    ),

    room

  );


  roomCode =
    code;


  playerNumber =
    1;


  enterGame();


  listenRoom();


  message.textContent =
    `방이 생성되었습니다.`
    + ` 방 코드: ${code}`;

}



/* ==========================================
   방 참가
   ========================================== */

async function joinRoom() {

  const message =
    document.getElementById(
      "lobbyMessage"
    );


  const input =
    document.getElementById(
      "roomCodeInput"
    );


  const code =
    input.value
      .trim()
      .toUpperCase();


  if (
    code.length !== 6
  ) {

    message.textContent =
      "6자리 방 코드를 입력하세요.";

    return;

  }


  /*
   * 방 검색
   */

  const snapshot =
    await window.firebaseGet(

      window.firebaseRef(
        database,
        "rooms/" + code
      )

    );


  if (!snapshot.exists()) {

    message.textContent =
      "존재하지 않는 방입니다.";

    return;

  }


  const room =
    snapshot.val();


  /*
   * 이미 시작된 방에는
   * 참가하지 못합니다.
   */

  if (
    room.phase !==
    "waiting"
  ) {

    message.textContent =
      "이미 게임이 시작된 방입니다.";

    return;

  }


  const players =
    room.players || {};


  const count =
    Object.keys(players).length;


  if (
    count >= 4
  ) {

    message.textContent =
      "이 방은 이미 4명입니다.";

    return;

  }


  /*
   * 새 플레이어 번호
   */

  const newNumber =
    count + 1;


  const updates = {};


  updates[
    `players/${playerId}`
  ] = {

    name:
      getNickname(),

    number:
      newNumber

  };


  await window.firebaseUpdate(

    window.firebaseRef(
      database,
      "rooms/" + code
    ),

    updates

  );


  roomCode =
    code;


  playerNumber =
    newNumber;


  enterGame();


  listenRoom();

}



/* ==========================================
   빈 오목판
   ========================================== */

function createEmptyBoard() {

  const board = [];


  for (
    let row = 0;
    row < 19;
    row++
  ) {

    board[row] = [];


    for (
      let col = 0;
      col < 19;
      col++
    ) {

      board[row][col] =
        null;

    }

  }


  return board;

}



/* ==========================================
   초기 백돌 생성
   ========================================== */

function createInitialStones(
  playerCount
) {

  /*
   * 백돌 개수
   *
   * 5 - 방 멤버 수
   */

  const count =
    5 - playerCount;


  const stones = {};


  /*
   * 방 인원은 1~4명이므로
   * 돌은 항상 1~4개입니다.
   */


  /*
   * 방향
   *
   * 0 = 가로
   * 1 = 세로
   * 2 = 대각선 ↘
   * 3 = 대각선 ↙
   */

  const direction =
    randomInteger(
      0,
      3
    );


  let row;
  let col;



  /* ===============================
     가로
     =============================== */

  if (
    direction === 0
  ) {

    row =
      randomInteger(
        1,
        17
      );


    col =
      randomInteger(
        1,
        18 - count
      );


    for (
      let i = 0;
      i < count;
      i++
    ) {

      stones[
        `${row}_${col + i}`
      ] = {

        row:
          row,

        col:
          col + i

      };

    }

  }



  /* ===============================
     세로
     =============================== */

  else if (
    direction === 1
  ) {

    col =
      randomInteger(
        1,
        17
      );


    row =
      randomInteger(
        1,
        18 - count
      );


    for (
      let i = 0;
      i < count;
      i++
    ) {

      stones[
        `${row + i}_${col}`
      ] = {

        row:
          row + i,

        col:
          col

      };

    }

  }



  /* ===============================
     대각선 ↘
     =============================== */

  else if (
    direction === 2
  ) {

    row =
      randomInteger(
        1,
        18 - count
      );


    col =
      randomInteger(
        1,
        18 - count
      );


    for (
      let i = 0;
      i < count;
      i++
    ) {

      stones[
        `${row + i}_${col + i}`
      ] = {

        row:
          row + i,

        col:
          col + i

      };

    }

  }



  /* ===============================
     대각선 ↙
     =============================== */

  else {

    row =
      randomInteger(
        1,
        18 - count
      );


    col =
      randomInteger(
        count,
        17
      );


    for (
      let i = 0;
      i < count;
      i++
    ) {

      stones[
        `${row + i}_${col - i}`
      ] = {

        row:
          row + i,

        col:
          col - i

      };

    }

  }


  return stones;

}



/* ==========================================
   랜덤 정수
   ========================================== */

function randomInteger(
  min,
  max
) {

  return Math.floor(
    Math.random() *
      (max - min + 1)
  ) + min;

}



/* ==========================================
   게임 화면
   ========================================== */

function enterGame() {

  document
    .getElementById(
      "lobbyScreen"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "gameScreen"
    )
    .classList.remove(
      "hidden"
    );


  document
    .getElementById(
      "roomCodeDisplay"
    )
    .textContent =
      roomCode;

}



/* ==========================================
   Firebase 방 실시간 감시
   ========================================== */

function listenRoom() {

  roomRef =
    window.firebaseRef(
      database,
      "rooms/" + roomCode
    );


  window.firebaseOnValue(

    roomRef,

    snapshot => {

      if (
        !snapshot.exists()
      ) {

        return;

      }


      currentRoom =
        snapshot.val();


      /*
       * 현재 플레이어 번호 갱신
       */

      if (
        currentRoom.players &&
        currentRoom.players[playerId]
      ) {

        playerNumber =
          currentRoom
            .players[playerId]
            .number;

      }


      renderGame();

    }

  );

}



/* ==========================================
   게임 전체 화면 업데이트
   ========================================== */

function renderGame() {

  renderPlayers();

  renderMessage();

  renderHints();

  renderBoard();

  renderResult();

}



/* ==========================================
   플레이어 목록
   ========================================== */

function renderPlayers() {

  const list =
    document.getElementById(
      "playerList"
    );


  list.innerHTML = "";


  const players =
    Object.values(
      currentRoom.players || {}
    )
    .sort(
      (a, b) =>
        a.number - b.number
    );


  document
    .getElementById(
      "playerCount"
    )
    .textContent =
      players.length;



  players.forEach(
    player => {

      const div =
        document.createElement(
          "div"
        );


      div.className =
        "player";


      /*
       * 자신 표시
       */

      if (
        player.number ===
        playerNumber
      ) {

        div.classList.add(
          "me"
        );

      }


      /*
       * 방장 표시
       */

      if (
        currentRoom.hostId &&
        Object.entries(
          currentRoom.players
        )
        .find(
          ([id, p]) =>
            id === currentRoom.hostId &&
            p.number === player.number
        )
      ) {

        div.classList.add(
          "host"
        );

      }


      div.textContent =
        `${player.number}번 ${player.name}`;


      if (
        currentRoom.hostId
      ) {

        const host =
          currentRoom.players[
            currentRoom.hostId
          ];


        if (
          host &&
          host.number ===
          player.number
        ) {

          div.textContent +=
            " 👑";

        }

      }


      list.appendChild(
        div
      );

    }
  );



  /*
   * 방장에게 게임 시작 버튼 표시
   */

  const startButton =
    document.getElementById(
      "startGameButton"
    );


  if (
    currentRoom.phase ===
      "waiting" &&
    currentRoom.hostId ===
      playerId
  ) {

    startButton.classList.remove(
      "hidden"
    );


    /*
     * 최소 1명으로도 시작 가능
     */

    startButton.disabled =
      players.length < 1;

  }

  else {

    startButton.classList.add(
      "hidden"
    );

  }

}



/* ==========================================
   게임 시작
   ========================================== */

async function startGame() {

  /*
   * 방장만 시작할 수 있음
   */

  if (
    currentRoom.hostId !==
    playerId
  ) {

    return;

  }


  if (
    currentRoom.phase !==
    "waiting"
  ) {

    return;

  }


  const players =
    Object.values(
      currentRoom.players || {}
    );


  const count =
    players.length;


  /*
   * 초기 백돌 생성
   */

  const initialStones =
    createInitialStones(
      count
    );


  /*
   * 게임 상태 저장
   */

  await window.firebaseUpdate(

    roomRef,

    {

      phase:
        "playing",

      currentTurn:
        1,

      initialStones:
        initialStones,

      target:
        null,

      guesses:
        {},

      hints:
        {},

      board:
        createEmptyBoard(),

      result:
        null,

      revealed:
        false

    }

  );

}



/* ==========================================
   안내 메시지
   ========================================== */

function renderMessage() {

  const message =
    document.getElementById(
      "gameMessage"
    );


  const count =
    Object.keys(
      currentRoom.players || {}
    ).length;



  if (
    currentRoom.phase ===
    "waiting"
  ) {

    if (
      currentRoom.hostId ===
      playerId
    ) {

      message.textContent =
        `${count}명이 참가했습니다. `
        + "게임 시작 버튼을 눌러주세요.";

    }

    else {

      message.textContent =
        "방장이 게임을 시작하기를 기다리고 있습니다.";

    }

    return;

  }



  if (
    currentRoom.phase ===
    "playing"
  ) {

    const turn =
      currentRoom.currentTurn;


    if (
      turn === playerNumber
    ) {

      if (
        turn === 1
      ) {

        message.textContent =
          "당신의 차례입니다. 원하는 위치를 선택하세요.";

      }

      else {

        message.textContent =
          "당신의 차례입니다. 힌트를 참고하여 위치를 선택하세요.";

      }

    }

    else {

      message.textContent =
        `${turn}번 플레이어의 차례입니다.`;

    }

    return;

  }



  if (
    currentRoom.phase ===
    "finished"
  ) {

    message.textContent =
      "모든 플레이어의 위치가 공개되었습니다.";

  }

}



/* ==========================================
   힌트
   ========================================== */

function renderHints() {

  const hintBox =
    document.getElementById(
      "hintBox"
    );


  /*
   * 1번 플레이어는 힌트 없음
   */

  if (
    currentRoom.phase !==
      "playing" ||
    playerNumber <= 1 ||
    currentRoom.currentTurn !==
      playerNumber
  ) {

    hintBox.classList.add(
      "hidden"
    );

    return;

  }


  /*
   * 이미 선택했다면 숨김
   */

  if (
    currentRoom.guesses &&
    currentRoom.guesses[playerId]
  ) {

    hintBox.classList.add(
      "hidden"
    );

    return;

  }


  /*
   * 현재 플레이어에게 저장된 힌트
   */

  const hint =
    currentRoom.hints &&
    currentRoom.hints[playerNumber];


  if (!hint) {

    hintBox.classList.add(
      "hidden"
    );

    return;

  }


  document
    .getElementById(
      "hint1"
    )
    .textContent =
      hint.first;


  document
    .getElementById(
      "hint2"
    )
    .textContent =
      hint.second;


  hintBox.classList.remove(
    "hidden"
  );

}



/* ==========================================
   오목판
   ========================================== */

function renderBoard() {

  const boardElement =
    document.getElementById(
      "board"
    );


  boardElement.innerHTML = "";


  const board =
    currentRoom.board ||
    createEmptyBoard();


  /*
   * 초기 돌
   */

  const initialStones =
    currentRoom.initialStones ||
    {};


  /*
   * 게임 종료 전에는
   * 실제 돌을 보여주기 위해
   * board를 사용합니다.
   */

  for (
    let row = 0;
    row < 19;
    row++
  ) {

    for (
      let col = 0;
      col < 19;
      col++
    ) {

      const cell =
        document.createElement(
          "button"
        );


      cell.className =
        "cell";



      /*
       * 백돌
       */

      if (
        board[row] &&
        board[row][col] ===
          "white"
      ) {

        addWhiteStone(
          cell
        );

      }



      /*
       * 초기 돌 표시
       *
       * 게임 시작 후에도
       * 위치 확인용 작은 표시
       */

      const key =
        `${row}_${col}`;


      if (
        initialStones[key]
      ) {

        const marker =
          document.createElement(
            "div"
          );


        marker.className =
          "initialMarker";


        cell.appendChild(
          marker
        );

      }



      /*
       * 게임 종료 후
       * 각 플레이어 선택 위치에
       * 작은 표시를 보여줌
       */

      if (
        currentRoom.phase ===
        "finished" &&
        currentRoom.guesses
      ) {

        Object.values(
          currentRoom.guesses
        )
        .forEach(
          guess => {

            if (
              guess.row === row &&
              guess.col === col
            ) {

              /*
               * 이미 백돌이 있는 곳에는
               * 별도 표시를 겹쳐서 넣지 않음
               */

              if (
                !board[row][col]
              ) {

                const marker =
                  document.createElement(
                    "div"
                  );


                marker.className =
                  "selectionMarker";


                cell.appendChild(
                  marker
                );

              }

            }

          }
        );

      }



      /*
       * 클릭
       */

      cell.addEventListener(
        "click",
        () => {

          selectPosition(
            row,
            col
          );

        }
      );


      boardElement.appendChild(
        cell
      );

    }

  }

}



/* ==========================================
   백돌 추가
   ========================================== */

function addWhiteStone(cell) {

  const stone =
    document.createElement(
      "div"
    );


  stone.className =
    "stone";


  cell.appendChild(
    stone
  );

}



/* ==========================================
   위치 선택
   ========================================== */

async function selectPosition(
  row,
  col
) {

  /*
   * 게임 중인지 확인
   */

  if (
    !currentRoom ||
    currentRoom.phase !==
      "playing"
  ) {

    return;

  }


  /*
   * 자신의 차례인지 확인
   */

  if (
    currentRoom.currentTurn !==
    playerNumber
  ) {

    return;

  }


  /*
   * 판 가장자리는 선택할 수 없음
   */

  if (
    row === 0 ||
    row === 18 ||
    col === 0 ||
    col === 18
  ) {

    alert(
      "판의 가장자리는 선택할 수 없습니다."
    );

    return;

  }


  /*
   * 기존 돌이 있으면 선택 불가
   */

  if (
    currentRoom.board[row][col]
  ) {

    alert(
      "이미 돌이 있는 위치입니다."
    );

    return;

  }


  /*
   * 이미 선택했는지 확인
   */

  if (
    currentRoom.guesses &&
    currentRoom.guesses[playerId]
  ) {

    return;

  }


  /*
   * 선택 위치 저장
   */

  const updates = {};


  updates[
    `guesses/${playerId}`
  ] = {

    row:
      row,

    col:
      col,

    number:
      playerNumber

  };


  /*
   * 다음 차례
   */

  if (
    playerNumber < 4
  ) {

    updates[
      "currentTurn"
    ] =
      playerNumber + 1;


    /*
     * 다음 플레이어에게
     * 현재 선택을 기반으로 힌트를 생성
     */

    const hint =
      createHint(
        row,
        col
      );


    updates[
      `hints/${playerNumber + 1}`
    ] =
      hint;

  }


  else {

    /*
     * 마지막 플레이어
     *
     * 모든 위치를 공개하기 위해
     * finished 상태로 변경
     */

    updates[
      "phase"
    ] =
      "finished";


    updates[
      "revealed"
    ] =
      true;

  }


  await window.firebaseUpdate(

    roomRef,

    updates

  );


  /*
   * 마지막 플레이어라면
   * 최종 판을 생성합니다.
   */

  if (
    playerNumber === 4
  ) {

    /*
     * 최신 Firebase 상태를 가져옵니다.
     */

    const snapshot =
      await window.firebaseGet(
        roomRef
      );


    const room =
      snapshot.val();


    finishGame(
      room
    );

  }

}



/* ==========================================
   힌트 생성
   ========================================== */

function createHint(
  realRow,
  realCol
) {

  /*
   * 문제의 규칙:
   *
   * 이전 플레이어가 고른 위치의
   * 가로 좌표 또는 세로 좌표 중 하나를
   * 진짜 힌트로 사용합니다.
   *
   * 같은 종류의 다른 좌표 하나는
   * 가짜 힌트입니다.
   *
   * 어느 것이 진짜인지는 표시하지 않습니다.
   */


  const useRow =
    Math.random() < 0.5;


  let realValue;

  let fakeValue;



  if (useRow) {

    /*
     * 세로 좌표(행)를 힌트로 사용
     */

    realValue =
      realRow;


    fakeValue =
      randomInteger(
        1,
        17
      );


    /*
     * 진짜와 다른 숫자가 되도록
     */

    while (
      fakeValue ===
      realValue
    ) {

      fakeValue =
        randomInteger(
          1,
          17
        );

    }


    const values = [

      `세로 ${realValue + 1}`,

      `세로 ${fakeValue + 1}`

    ];


    /*
     * 순서를 무작위로 섞음
     */

    if (
      Math.random() < 0.5
    ) {

      values.reverse();

    }


    return {

      first:
        values[0],

      second:
        values[1]

    };

  }


  else {

    /*
     * 가로 좌표(열)를 힌트로 사용
     */

    realValue =
      realCol;


    fakeValue =
      randomInteger(
        1,
        17
      );


    while (
      fakeValue ===
      realValue
    ) {

      fakeValue =
        randomInteger(
          1,
          17
        );

    }


    const values = [

      `가로 ${realValue + 1}`,

      `가로 ${fakeValue + 1}`

    ];


    if (
      Math.random() < 0.5
    ) {

      values.reverse();

    }


    return {

      first:
        values[0],

      second:
        values[1]

    };

  }

}



/* ==========================================
   마지막 결과 계산
   ========================================== */

async function finishGame(
  room
) {

  /*
   * 현재 판 복사
   */

  const board =
    JSON.parse(
      JSON.stringify(
        room.board
      )
    );


  /*
   * 모든 플레이어가 선택한 위치에
   * 백돌을 놓습니다.
   */

  const guesses =
    room.guesses || {};


  Object.values(
    guesses
  )
  .forEach(
    guess => {

      board[
        guess.row
      ][
        guess.col
      ] =
        "white";

    }
  );


  /*
   * 오목 확인
   */

  const completed =
    checkOmok(
      board
    );


  /*
   * 결과 저장
   */

  await window.firebaseUpdate(

    roomRef,

    {

      board:
        board,

      result:
        completed,

      phase:
        "finished",

      revealed:
        true

    }

  );

}



/* ==========================================
   오목 판정
   ========================================== */

function checkOmok(
  board
) {

  /*
   * 검사 방향
   *
   * → 가로
   * ↓ 세로
   * ↘ 대각선
   * ↙ 대각선
   */

  const directions = [

    [0, 1],

    [1, 0],

    [1, 1],

    [1, -1]

  ];



  for (
    let row = 0;
    row < 19;
    row++
  ) {

    for (
      let col = 0;
      col < 19;
      col++
    ) {

      /*
       * 돌이 없으면 건너뜀
       */

      if (
        !board[row][col]
      ) {

        continue;

      }


      const color =
        board[row][col];


      /*
       * 네 방향 검사
       */

      for (
        const [
          dr,
          dc
        ] of directions
      ) {

        let count = 1;


        /*
         * 같은 방향으로
         * 돌이 몇 개 연결되는지 확인
         */

        for (
          let i = 1;
          i < 5;
          i++
        ) {

          const nextRow =
            row +
            dr * i;


          const nextCol =
            col +
            dc * i;


          /*
           * 판 밖
           */

          if (
            nextRow < 0 ||
            nextRow >= 19 ||
            nextCol < 0 ||
            nextCol >= 19
          ) {

            break;

          }


          /*
           * 같은 색의 돌
           */

          if (
            board[nextRow][nextCol] ===
            color
          ) {

            count++;

          }

          else {

            break;

          }

        }


        /*
         * 5개 이상 연결
         */

        if (
          count >= 5
        ) {

          return true;

        }

      }

    }

  }


  return false;

}



/* ==========================================
   결과 화면
   ========================================== */

function renderResult() {

  const resultBox =
    document.getElementById(
      "resultBox"
    );


  if (
    currentRoom.phase !==
    "finished"
  ) {

    resultBox.classList.add(
      "hidden"
    );

    return;

  }


  resultBox.classList.remove(
    "hidden"
  );


  const title =
    document.getElementById(
      "resultTitle"
    );


  const text =
    document.getElementById(
      "resultText"
    );


  if (
    currentRoom.result ===
    true
  ) {

    title.textContent =
      "오목 완성!";


    text.textContent =
      "백돌 5개 이상이 연결되었습니다.";

  }

  else {

    title.textContent =
      "오목 미완성";


    text.textContent =
      "백돌 5개 이상이 연결되지 않았습니다.";

  }

}