package com.cereja.kanban.infrastructure.sse;

import com.cereja.kanban.application.events.IBoardEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SseEmitterService implements IBoardEventPublisher {
    private final Map<Long, List<SseEmitter>> emittersByBoard = new ConcurrentHashMap<>();



    public SseEmitter subscribe(Long boardId) {
        SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
        emittersByBoard.computeIfAbsent(boardId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeEmitter(boardId, emitter));
        emitter.onTimeout(() -> removeEmitter(boardId, emitter));
        emitter.onError(e -> removeEmitter(boardId, emitter));
        return emitter;
    }
    public void removeEmitter(Long boardId, SseEmitter emitter) {
        List<SseEmitter> emitters = emittersByBoard.get(boardId);
        if (emitters != null) {
            emitters.remove(emitter);
        }
    }

    @Override
    public void publish(Long boardId, String eventName, Object payload) {
        List<SseEmitter> emitters = emittersByBoard.get(boardId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : emitters) {
            try {
                // Monta o aviso e transmite pelo aparelho:
                emitter.send(SseEmitter.event()
                        .name(eventName)
                        .data(payload));
            } catch (Exception e) {
                // Se der erro de transmissão (ex: caiu a internet do aluno na hora), faxina nele:
                removeEmitter(boardId, emitter);
            }
        }
    }

    @Scheduled(fixedRate = 30000)
    public void sendHeartbeat() {
        emittersByBoard.forEach((boardId, emitters) -> {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    removeEmitter(boardId, emitter);
                }
            }
        });
    }
}
