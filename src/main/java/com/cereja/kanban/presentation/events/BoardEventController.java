package com.cereja.kanban.presentation.events;

import com.cereja.kanban.infrastructure.sse.SseEmitterService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class BoardEventController {

    private final SseEmitterService sseEmitterService;

    public BoardEventController(SseEmitterService sseEmitterService) {
        this.sseEmitterService = sseEmitterService;
    }

    @GetMapping(value = "/api/events/boards/{boardId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeBoardEvents(@PathVariable Long boardId) {
        return sseEmitterService.subscribe(boardId);
    }
}